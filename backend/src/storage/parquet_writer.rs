//! Parquet 列式写入器
//!
//! 将内存中的事件批次转换为 Arrow RecordBatch，
//! 应用列级压缩后写入 Parquet 文件。
//! 支持字典编码、Delta 编码和 Snappy 压缩。

use std::fs::File;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use arrow::array::{ArrayRef, Int32Array, Int64Array, Int8Array, Int16Array, StringArray, TimestampNanosecondArray};
use arrow::datatypes::{DataType, Field, Schema, TimeUnit};
use arrow::record_batch::RecordBatch;
use parquet::arrow::ArrowWriter;
use parquet::basic::{Compression, Encoding};
use parquet::file::properties::WriterProperties;
use parquet::file::writer::SerializedFileWriter;
use chrono::{DateTime, Utc};
use crate::error::{HunTianError, HunTianResult};
use crate::models::Event;

/// Parquet 列式写入器
///
/// 接收 Event 批次，转换为 Arrow 格式，
/// 应用列级压缩，写入 Parquet 文件。
pub struct ParquetWriter {
    /// 数据目录
    data_dir: PathBuf,
    /// 当前分区的写入缓冲区
    buffer: Vec<Event>,
    /// 单分区最大事件数
    max_events_per_partition: u64,
}

impl ParquetWriter {
    /// Arrow Schema 定义（与 Event 结构对应）
    fn arrow_schema() -> Schema {
        Schema::new(vec![
            Field::new("id", DataType::Int64, false),
            Field::new("timestamp", DataType::Timestamp(TimeUnit::Nanosecond, Some("UTC".into())), false),
            Field::new("user_id", DataType::Int32, false),
            Field::new("session_id", DataType::Int64, false),
            Field::new("event_type", DataType::Int8, false),
            Field::new("lock_id", DataType::Int32, false),
            Field::new("zone", DataType::Int8, false),
            Field::new("region", DataType::Int8, false),
            Field::new("status_code", DataType::Int16, false),
            Field::new("ip_address", DataType::Int32, false),
            Field::new("parent_event_id", DataType::Int64, false),
            Field::new("error_msg", DataType::Utf8, true),
            Field::new("metadata_json", DataType::Utf8, true),
        ])
    }

    /// 创建新的 Parquet 写入器
    pub fn new(data_dir: PathBuf, max_events_per_partition: u64) -> Self {
        std::fs::create_dir_all(&data_dir).ok();
        Self {
            data_dir,
            buffer: Vec::with_capacity(max_events_per_partition as usize + 1024),
            max_events_per_partition,
        }
    }

    /// 追加事件到写入缓冲区
    ///
    /// 当缓冲区达到阈值时自动触发 flush。
    pub fn append(&mut self, events: &[Event]) -> HunTianResult<Option<PartitionInfo>> {
        self.buffer.extend_from_slice(events);
        if self.buffer.len() as u64 >= self.max_events_per_partition {
            Ok(Some(self.flush()?))
        } else {
            Ok(None)
        }
    }

    /// 强制刷盘当前缓冲区的所有事件
    pub fn flush(&mut self) -> HunTianResult<PartitionInfo> {
        if self.buffer.is_empty() {
            return Ok(PartitionInfo::default());
        }

        let events = std::mem::take(&mut self.buffer);
        let event_count = events.len() as u64;

        // 计算分区路径
        let now = Utc::now();
        let partition_dir = self.data_dir
            .join(now.format("%Y-%m-%d").to_string())
            .join(now.format("%H-%M").to_string());
        std::fs::create_dir_all(&partition_dir)?;

        let file_path = partition_dir.join("events.parquet");

        // 转换为 Arrow RecordBatch
        let batch = Self::events_to_record_batch(&events)?;

        // 配置列级压缩
        let props = WriterProperties::builder()
            .set_compression(Compression::SNAPPY)
            // 字典编码：低基数列
            .set_column_encoding(2.into(), Encoding::RLE_DICTIONARY)  // user_id
            .set_column_encoding(3.into(), Encoding::RLE_DICTIONARY)  // session_id
            .set_column_encoding(5.into(), Encoding::RLE_DICTIONARY)  // lock_id
            .set_column_encoding(6.into(), Encoding::RLE_DICTIONARY)  // zone
            .set_column_encoding(7.into(), Encoding::RLE_DICTIONARY)  // region
            // Delta 编码：时间序列
            .set_column_encoding(1.into(), Encoding::DELTA_BINARY_PACKED) // timestamp
            .build();

        let file = File::create(&file_path)?;
        let mut writer = ArrowWriter::try_new(file, batch.schema(), Some(props))?;

        writer.write(&batch)?;
        let metadata = writer.close()?;

        Ok(PartitionInfo {
            path: partition_dir.to_string_lossy().into(),
            event_count,
            file_size: metadata.file_metadata().num_rows() as u64 * 80, // 估算每行80字节
            min_timestamp: 0,
            max_timestamp: 0,
        })
    }

    /// 将 Event 列表转换为 Arrow RecordBatch
    fn events_to_record_batch(events: &[Event]) -> HunTianResult<RecordBatch> {
        let schema = Arc::new(Self::arrow_schema());
        let len = events.len();

        let mut ids = Vec::with_capacity(len);
        let mut timestamps = Vec::with_capacity(len);
        let mut user_ids = Vec::with_capacity(len);
        let mut session_ids = Vec::with_capacity(len);
        let mut event_types = Vec::with_capacity(len);
        let mut lock_ids = Vec::with_capacity(len);
        let mut zones = Vec::with_capacity(len);
        let mut regions = Vec::with_capacity(len);
        let mut status_codes = Vec::with_capacity(len);
        let mut ip_addresses = Vec::with_capacity(len);
        let mut parent_ids = Vec::with_capacity(len);
        let mut error_msgs: Vec<Option<String>> = Vec::with_capacity(len);
        let mut metadatas: Vec<Option<String>> = Vec::with_capacity(len);

        for e in events {
            ids.push(e.id);
            timestamps.push(e.timestamp.timestamp_nanos_opt().unwrap_or(0));
            user_ids.push(e.user_id);
            session_ids.push(e.session_id);
            event_types.push(e.event_type);
            lock_ids.push(e.lock_id);
            zones.push(e.zone);
            regions.push(e.region);
            status_codes.push(e.status_code);
            ip_addresses.push(e.ip_address);
            parent_ids.push(e.parent_event_id);
            error_msgs.push(e.error_msg.clone());
            metadatas.push(e.metadata_json.clone());
        }

        let arrays: Vec<ArrayRef> = vec![
            Arc::new(Int64Array::from(ids)),
            Arc::new(TimestampNanosecondArray::from(timestamps)),
            Arc::new(Int32Array::from(user_ids)),
            Arc::new(Int64Array::from(session_ids)),
            Arc::new(Int8Array::from(event_types)),
            Arc::new(Int32Array::from(lock_ids)),
            Arc::new(Int8Array::from(zones)),
            Arc::new(Int8Array::from(regions)),
            Arc::new(Int16Array::from(status_codes)),
            Arc::new(Int32Array::from(ip_addresses)),
            Arc::new(Int64Array::from(parent_ids)),
            Arc::new(StringArray::from(error_msgs)),
            Arc::new(StringArray::from(metadatas)),
        ];

        Ok(RecordBatch::try_new(schema, arrays).map_err(|e| {
            HunTianError::Internal(format!("Arrow RecordBatch 创建失败: {}", e))
        })?)
    }
}

/// 分区刷盘后的元信息
#[derive(Debug, Clone, Default)]
pub struct PartitionInfo {
    pub path: String,
    pub event_count: u64,
    pub file_size: u64,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}
