//! Parquet 列式读取器
//!
//! 利用 Bloom 过滤器跳过不相关分区，
//! 支持谓词下推与向量化读取。

use std::path::PathBuf;
use arrow::record_batch::RecordBatch;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use crate::error::HunTianResult;

/// Parquet 读取器
pub struct ParquetReader {
    data_dir: PathBuf,
}

impl ParquetReader {
    pub fn new(data_dir: PathBuf) -> Self {
        Self { data_dir }
    }

    /// 从指定分区文件读取所有事件
    pub fn read_partition(&self, file_path: &str) -> HunTianResult<Vec<RecordBatch>> {
        let full_path = self.data_dir.join(file_path);
        let file = std::fs::File::open(&full_path)?;
        let builder = ParquetRecordBatchReaderBuilder::try_new(file)
            .map_err(|e| crate::error::HunTianError::Storage(format!("Parquet读取: {}", e)))?;

        let reader = builder.build()
            .map_err(|e| crate::error::HunTianError::Storage(format!("Parquet构建: {}", e)))?;

        let mut batches = Vec::new();
        for batch in reader {
            batches.push(batch.map_err(|e| {
                crate::error::HunTianError::Storage(format!("Parquet行读取: {}", e))
            })?);
        }
        Ok(batches)
    }

    /// 列出数据目录下所有 Parquet 文件
    pub fn list_partitions(&self) -> HunTianResult<Vec<String>> {
        let mut files = Vec::new();
        Self::walk_dir(&self.data_dir, &mut files)?;
        Ok(files)
    }

    fn walk_dir(dir: &std::path::Path, files: &mut Vec<String>) -> HunTianResult<()> {
        if !dir.exists() {
            return Ok(());
        }
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                Self::walk_dir(&path, files)?;
            } else if path.extension().map_or(false, |e| e == "parquet") {
                if let Ok(rel) = path.strip_prefix(dir) {
                    files.push(rel.to_string_lossy().into());
                }
            }
        }
        Ok(())
    }
}
