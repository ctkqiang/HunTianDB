//! WAL 生产模块 — 校验和、检查点、LSN 恢复
//!
//! 每个 WAL 条目格式 v4:
//!   [1B 版本=0x04][4B LE CRC32][8B LE LSN][4B LE uncomp_len][4B LE comp_len][zstd(bincode WalOp)]
//!
//! 检查点文件 (checkpoint.bin):
//!   [8B LE last_lsn][8B LE wal_offset]

pub mod checksum;
pub mod checkpoint;

pub use checksum::*;
pub use checkpoint::*;
