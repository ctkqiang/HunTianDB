//! 混天DB 核心数据模型
//!
//! 所有事件记录均不可变（仅追加），无 UPDATE/DELETE 操作。

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 安全审计事件 — 混天DB 的核心存储单元
///
/// 每条事件记录代表一次安全审计或金融交易，
/// 写入后即不可变，支持时间点快照与取证追踪。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    /// 事件唯一标识（单调递增）
    pub id: i64,
    /// 事件时间戳（UTC毫秒）
    pub timestamp: DateTime<Utc>,
    /// 触发事件的用户ID
    pub user_id: i32,
    /// 会话ID（关联同一会话的多个事件）
    pub session_id: i64,
    /// 事件类型码：
    ///   - 1=认证, 2=授权, 3=数据访问, 4=配置变更
    ///   - 5=锁获取, 6=锁释放, 7=金融交易, 8=错误
    pub event_type: i8,
    /// 关联的锁ID（用于锁冲突分析）
    pub lock_id: i32,
    /// 安全分区（0-255）
    pub zone: i8,
    /// 地理区域码
    pub region: i8,
    /// 操作状态码
    pub status_code: i16,
    /// 客户端IP地址（IPv4编码为i32）
    pub ip_address: i32,
    /// 父事件ID（用于因果链追踪，0表示根事件）
    pub parent_event_id: i64,
    /// 错误消息（可选，仅错误事件有值）
    pub error_msg: Option<String>,
    /// 扩展元数据（JSON格式，可选）
    pub metadata_json: Option<String>,
}

impl Event {
    /// 创建新的事件记录，自动生成时间戳
    pub fn new(
        id: i64,
        user_id: i32,
        session_id: i64,
        event_type: i8,
        lock_id: i32,
        zone: i8,
        region: i8,
        status_code: i16,
        ip_address: i32,
    ) -> Self {
        Self {
            id,
            timestamp: Utc::now(),
            user_id,
            session_id,
            event_type,
            lock_id,
            zone,
            region,
            status_code,
            ip_address,
            parent_event_id: 0,
            error_msg: None,
            metadata_json: None,
        }
    }

    /// 设置父事件ID，建立因果链
    pub fn with_parent(mut self, parent_id: i64) -> Self {
        self.parent_event_id = parent_id;
        self
    }

    /// 附加错误消息
    pub fn with_error(mut self, msg: impl Into<String>) -> Self {
        self.error_msg = Some(msg.into());
        self
    }

    /// 附加扩展元数据
    pub fn with_metadata(mut self, json: impl Into<String>) -> Self {
        self.metadata_json = Some(json.into());
        self
    }
}

/// WAL 记录封装 — 写入前日志的每条记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalEntry {
    /// 全局序列号（单调递增）
    pub sequence: u64,
    /// 事件数据（bincode序列化）
    pub event: Event,
    /// 校验和（CRC32）
    pub checksum: u32,
}

/// 时间分区清单 — 每个分区的元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartitionManifest {
    /// 分区路径（例如 "2026-05-19/14-00"）
    pub path: String,
    /// 分区内事件数量
    pub event_count: u64,
    /// 时间范围起始（UTC毫秒）
    pub min_timestamp: i64,
    /// 时间范围结束（UTC毫秒）
    pub max_timestamp: i64,
    /// 各列的 Bloom 过滤器（序列化为base64）
    pub bloom_filters: BloomFilterSet,
    /// 文件大小（字节）
    pub file_size: u64,
}

/// Bloom 过滤器集合 — 加速分区裁剪
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BloomFilterSet {
    /// user_id 列的 Bloom 过滤器
    pub user_id: Option<String>,
    /// session_id 列的 Bloom 过滤器
    pub session_id: Option<String>,
    /// lock_id 列的 Bloom 过滤器
    pub lock_id: Option<String>,
    /// zone 列的 Bloom 过滤器
    pub zone: Option<String>,
}

/// 快照元数据 — 时间点快照
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotMetadata {
    /// 快照唯一标识
    pub snapshot_id: String,
    /// 快照时间点
    pub timestamp: DateTime<Utc>,
    /// 对应的 Parquet 文件路径
    pub parquet_file: String,
    /// 文件内字节偏移
    pub byte_offset: u64,
    /// 该快照时的全局序列号
    pub sequence_number: u64,
}

/// 锁追踪记录 — 用于死锁检测与取证
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockRecord {
    pub lock_id: i32,
    pub acquired_at: DateTime<Utc>,
    pub released_at: Option<DateTime<Utc>>,
    pub holder_pid: i32,
    /// 冲突的进程ID列表
    pub conflict_pids: Vec<i32>,
}
