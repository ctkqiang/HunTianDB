//! 检查点 + LSN 恢复
//!
//! 全局 LSN 单调递增，每条 WAL 记录分配唯一 LSN。
//! 定期写入检查点文件，崩溃恢复时从最近检查点开始回放。

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// 全局 LSN 计数器（线程安全）
pub struct LsnCounter {
    inner: AtomicU64,
}

impl LsnCounter {
    pub fn new(start: u64) -> Self {
        Self { inner: AtomicU64::new(start) }
    }

    /// 分配下一个 LSN（原子递增）
    pub fn next(&self) -> u64 {
        self.inner.fetch_add(1, Ordering::SeqCst)
    }

    /// 当前 LSN（不递增）
    pub fn current(&self) -> u64 {
        self.inner.load(Ordering::SeqCst)
    }
}

/// 检查点记录
#[derive(Debug, Clone)]
pub struct Checkpoint {
    pub last_lsn: u64,
    pub wal_offset: u64, // WAL 文件中的字节偏移
}

impl Checkpoint {
    /// 序列化: [8B LE last_lsn][8B LE wal_offset]
    pub fn to_bytes(&self) -> [u8; 16] {
        let mut buf = [0u8; 16];
        buf[..8].copy_from_slice(&self.last_lsn.to_le_bytes());
        buf[8..].copy_from_slice(&self.wal_offset.to_le_bytes());
        buf
    }

    /// 反序列化
    pub fn from_bytes(data: &[u8]) -> Option<Self> {
        if data.len() < 16 { return None; }
        let last_lsn = u64::from_le_bytes([
            data[0], data[1], data[2], data[3], data[4], data[5], data[6], data[7],
        ]);
        let wal_offset = u64::from_le_bytes([
            data[8], data[9], data[10], data[11], data[12], data[13], data[14], data[15],
        ]);
        Some(Self { last_lsn, wal_offset })
    }

    /// 写入检查点文件
    pub fn write_to(&self, path: &Path) -> std::io::Result<()> {
        let tmp = path.with_extension("tmp");
        std::fs::write(&tmp, &self.to_bytes())?;
        // 原子重命名，防止写入中断时留下损坏文件
        std::fs::rename(&tmp, path)?;
        // fsync 父目录 (sync_commit = Strict)
        if let Some(parent) = path.parent() {
            if let Ok(f) = std::fs::File::open(parent) {
                let _ = f.sync_all();
            }
        }
        tracing::debug!(last_lsn = self.last_lsn, wal_offset = self.wal_offset, "检查点已写入");
        Ok(())
    }

    /// 读取最新检查点
    pub fn read_latest(path: &Path) -> Option<Self> {
        let data = std::fs::read(path).ok()?;
        Self::from_bytes(&data)
    }
}

/// 检查点管理器 — 定期将当前 LSN 和 WAL 偏移写入磁盘
pub struct CheckpointManager {
    path: PathBuf,
    lsn: Arc<LsnCounter>,
}

impl CheckpointManager {
    pub fn new(data_dir: &Path, lsn: Arc<LsnCounter>) -> Self {
        Self {
            path: data_dir.join("checkpoint.bin"),
            lsn,
        }
    }

    /// 执行检查点：写入当前 LSN 和 WAL 偏移
    pub fn do_checkpoint(&self, wal_offset: u64) -> std::io::Result<()> {
        let cp = Checkpoint {
            last_lsn: self.lsn.current(),
            wal_offset,
        };
        cp.write_to(&self.path)
    }

    /// 读取最近一次检查点（用于崩溃恢复）
    pub fn latest(&self) -> Option<Checkpoint> {
        Checkpoint::read_latest(&self.path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lsn_counter() {
        let c = LsnCounter::new(100);
        assert_eq!(c.next(), 100);  // fetch_add 返回旧值
        assert_eq!(c.next(), 101);  // fetch_add 返回旧值
        assert_eq!(c.current(), 102); // 两次递增后当前值为 102
    }

    #[test]
    fn test_checkpoint_roundtrip() {
        let cp = Checkpoint { last_lsn: 42, wal_offset: 1048576 };
        let bytes = cp.to_bytes();
        let restored = Checkpoint::from_bytes(&bytes).unwrap();
        assert_eq!(restored.last_lsn, 42);
        assert_eq!(restored.wal_offset, 1048576);
    }

    #[test]
    fn test_checkpoint_corrupted() {
        assert!(Checkpoint::from_bytes(&[0u8; 8]).is_none());
    }
}
