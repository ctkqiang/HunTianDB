//! Parquet 列式写入器
//!
//! 将内存中的事件批次转换为 Arrow RecordBatch，
//! 应用列级压缩后写入 Parquet 文件。

use std::fs::File;
use std::path::PathBuf;
use std::sync::Arc;
use arrow::array::{ArrayRef, Int32Array, Int64Array, Int8Array, Int16Array, StringArray, TimestampNanosecondArray};
use arrow::datatypes::{DataType, Field, Schema, TimeUnit};
use arrow::record_batch::RecordBatch;
use parquet::arrow::ArrowWriter;
use parquet::basic::{Compression, Encoding};
use parquet::file::properties::WriterProperties;
use parquet::schema::types::ColumnPath;
use chrono::Utc;
use crate::error::{HunTianError, HunTianResult};
use crate::models::Event;

/// Parquet 列式写入器
pub struct ParquetWriter {
    data_dir: PathBuf,
    buffer: Vec<Event>,
    max_events_per_partition: u64,
}

impl ParquetWriter {
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

    pub fn new(data_dir: PathBuf, max_events_per_partition: u64) -> Self {
        std::fs::create_dir_all(&data_dir).ok();
        Self {
            data_dir,
            buffer: Vec::with_capacity(max_events_per_partition as usize + 1024),
            max_events_per_partition,
        }
    }

    pub fn append(&mut self, events: &[Event]) -> HunTianResult<Option<PartitionInfo>> {
        self.buffer.extend_from_slice(events);
        if self.buffer.len() as u64 >= self.max_events_per_partition {
            Ok(Some(self.flush()?))
        } else {
            Ok(None)
        }
    }

    pub fn flush(&mut self) -> HunTianResult<PartitionInfo> {
        if self.buffer.is_empty() {
            return Ok(PartitionInfo::default());
        }

        let events = std::mem::take(&mut self.buffer);
        let event_count = events.len() as u64;

        let now = Utc::now();
        let partition_dir = self.data_dir
            .join(now.format("%Y-%m-%d").to_string())
            .join(now.format("%H-%M").to_string());
        std::fs::create_dir_all(&partition_dir)?;

        let file_path = partition_dir.join("events.parquet");
        let batch = Self::events_to_record_batch(&events)?;

        let props = WriterProperties::builder()
            .set_compression(Compression::SNAPPY)
            .set_column_encoding(ColumnPath::from("user_id"), Encoding::RLE_DICTIONARY)
            .set_column_encoding(ColumnPath::from("session_id"), Encoding::RLE_DICTIONARY)
            .set_column_encoding(ColumnPath::from("lock_id"), Encoding::RLE_DICTIONARY)
            .set_column_encoding(ColumnPath::from("zone"), Encoding::RLE_DICTIONARY)
            .set_column_encoding(ColumnPath::from("region"), Encoding::RLE_DICTIONARY)
            .set_column_encoding(ColumnPath::from("timestamp"), Encoding::DELTA_BINARY_PACKED)
            .build();

        let file = File::create(&file_path)?;
        let mut writer = ArrowWriter::try_new(file, batch.schema(), Some(props))?;
        writer.write(&batch)?;
        writer.close()?;

        Ok(PartitionInfo {
            path: partition_dir.to_string_lossy().into(),
            event_count,
            file_size: event_count * 80,
            min_timestamp: 0,
            max_timestamp: 0,
        })
    }

    fn events_to_record_batch(events: &[Event]) -> HunTianResult<RecordBatch> {
        let schema = Arc::new(Self::arrow_schema());
        let len = events.len();

        let ids: Vec<i64> = events.iter().map(|e| e.id).collect();
        let timestamps: Vec<i64> = events.iter().map(|e| e.timestamp.timestamp_nanos_opt().unwrap_or(0)).collect();
        let user_ids: Vec<i32> = events.iter().map(|e| e.user_id).collect();
        let session_ids: Vec<i64> = events.iter().map(|e| e.session_id).collect();
        let event_types: Vec<i8> = events.iter().map(|e| e.event_type).collect();
        let lock_ids: Vec<i32> = events.iter().map(|e| e.lock_id).collect();
        let zones: Vec<i8> = events.iter().map(|e| e.zone).collect();
        let regions: Vec<i8> = events.iter().map(|e| e.region).collect();
        let status_codes: Vec<i16> = events.iter().map(|e| e.status_code).collect();
        let ip_addresses: Vec<i32> = events.iter().map(|e| e.ip_address).collect();
        let parent_ids: Vec<i64> = events.iter().map(|e| e.parent_event_id).collect();
        let error_msgs: Vec<Option<String>> = events.iter().map(|e| e.error_msg.clone()).collect();
        let metadatas: Vec<Option<String>> = events.iter().map(|e| e.metadata_json.clone()).collect();

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

        RecordBatch::try_new(schema, arrays)
            .map_err(|e| HunTianError::Internal(format!("Arrow RecordBatch: {}", e)))
    }
}

#[derive(Debug, Clone, Default)]
pub struct PartitionInfo {
    pub path: String,
    pub event_count: u64,
    pub file_size: u64,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}
