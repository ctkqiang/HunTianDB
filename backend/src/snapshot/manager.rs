//! 快照生命周期管理器
//!
//! 创建、查询和删除时间点快照。

use std::collections::HashMap;
use parking_lot::RwLock;
use chrono::Utc;
use uuid::Uuid;
use crate::error::HunTianResult;
use crate::models::SnapshotMetadata;

/// 快照管理器
pub struct SnapshotManager {
    /// 快照注册表（snapshot_id → 元数据）
    snapshots: RwLock<HashMap<String, SnapshotMetadata>>,
}

impl SnapshotManager {
    pub fn new() -> Self {
        Self {
            snapshots: RwLock::new(HashMap::new()),
        }
    }

    /// 创建新快照
    ///
    /// 记录当前全局序列号、对应的 Parquet 文件和字节偏移。
    pub fn create_snapshot(
        &self,
        parquet_file: String,
        byte_offset: u64,
        sequence_number: u64,
    ) -> HunTianResult<String> {
        let id = Uuid::new_v4().to_string();

        let metadata = SnapshotMetadata {
            snapshot_id: id.clone(),
            timestamp: Utc::now(),
            parquet_file,
            byte_offset,
            sequence_number,
        };

        self.snapshots.write().insert(id.clone(), metadata);
        tracing::info!("快照已创建: {}", id);
        Ok(id)
    }

    /// 列出所有快照
    pub fn list_snapshots(&self) -> Vec<SnapshotMetadata> {
        self.snapshots.read().values().cloned().collect()
    }

    /// 获取指定快照的元数据
    pub fn get_snapshot(&self, id: &str) -> Option<SnapshotMetadata> {
        self.snapshots.read().get(id).cloned()
    }

    /// 删除快照
    pub fn delete_snapshot(&self, id: &str) -> bool {
        self.snapshots.write().remove(id).is_some()
    }
}
