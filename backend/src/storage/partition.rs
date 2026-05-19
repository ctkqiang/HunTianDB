//! 时间分区管理器
//!
//! 按「年-月-日/时-分」格式组织 Parquet 分区，
//! 维护分区清单（manifest.json），加速时间范围查询。

use std::collections::BTreeMap;
use std::path::PathBuf;
use crate::error::HunTianResult;
use crate::models::PartitionManifest;

/// 分区管理器
pub struct PartitionManager {
    /// 数据根目录
    data_dir: PathBuf,
    /// 内存中的分区清单缓存
    manifests: BTreeMap<String, PartitionManifest>,
}

impl PartitionManager {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            data_dir,
            manifests: BTreeMap::new(),
        }
    }

    /// 加载所有分区清单
    pub fn load_manifests(&mut self) -> HunTianResult<()> {
        self.manifests.clear();
        // 遍历数据目录，加载每个分区的 manifest.json
        Self::scan_partitions(&self.data_dir, &mut self.manifests)?;
        Ok(())
    }

    /// 根据时间范围过滤分区
    ///
    /// 返回与 [start_ms, end_ms] 有时间重叠的所有分区路径。
    pub fn filter_by_time_range(
        &self,
        start_ms: i64,
        end_ms: i64,
    ) -> Vec<&PartitionManifest> {
        self.manifests
            .values()
            .filter(|m| m.max_timestamp >= start_ms && m.min_timestamp <= end_ms)
            .collect()
    }

    fn scan_partitions(
        dir: &std::path::Path,
        manifests: &mut BTreeMap<String, PartitionManifest>,
    ) -> HunTianResult<()> {
        if !dir.exists() {
            return Ok(());
        }
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                let manifest_path = path.join("partition_manifest.json");
                if manifest_path.exists() {
                    let content = std::fs::read_to_string(&manifest_path)?;
                    if let Ok(manifest) = serde_json::from_str::<PartitionManifest>(&content) {
                        manifests.insert(manifest.path.clone(), manifest);
                    }
                }
                Self::scan_partitions(&path, manifests)?;
            }
        }
        Ok(())
    }
}
