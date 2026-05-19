//! 快照注册表
//!
//! 维护所有快照的索引，支持按时间/序列号快速查找。

use std::collections::BTreeMap;
use crate::models::SnapshotMetadata;

/// 快照注册表
///
/// 使用 BTreeMap 按序列号有序存储。
pub struct SnapshotRegistry {
    /// sequence_number → 快照列表（同一序列号可能有多个快照）
    by_sequence: BTreeMap<u64, Vec<SnapshotMetadata>>,
}

impl SnapshotRegistry {
    pub fn new() -> Self {
        Self {
            by_sequence: BTreeMap::new(),
        }
    }

    /// 注册新快照
    pub fn register(&mut self, metadata: SnapshotMetadata) {
        self.by_sequence
            .entry(metadata.sequence_number)
            .or_default()
            .push(metadata);
    }

    /// 查找指定序列号之前的最近快照（时间点查询）
    pub fn find_nearest_before(&self, sequence: u64) -> Option<&SnapshotMetadata> {
        self.by_sequence
            .range(..=sequence)
            .next_back()
            .and_then(|(_, snapshots)| snapshots.first())
    }
}
