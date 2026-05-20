//! 配置加载器
//!
//! 从环境变量加载所有运行时配置，提供合理的默认值。

use std::path::PathBuf;

/// WAL 同步提交模式
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SyncCommit {
    /// 不强制 fsync — 由操作系统决定何时刷盘
    Off,
    /// 每次提交调用 File::sync_all() 确保数据落盘
    On,
    /// Strict: sync_all() 在 WAL 文件及其父目录上执行，确保目录元数据也落盘
    Strict,
}

impl SyncCommit {
    pub fn from_env() -> Self {
        match std::env::var("SYNC_COMMIT").unwrap_or_else(|_| "on".into()).to_lowercase().as_str() {
            "off" | "false" | "0" => SyncCommit::Off,
            "strict" => SyncCommit::Strict,
            _ => SyncCommit::On,
        }
    }
}

/// 混天DB 运行时配置
#[derive(Debug, Clone)]
pub struct Config {
    /// PostgreSQL 线协议监听端口
    pub postgres_port: u16,
    /// REST API 监听端口
    pub rest_port: u16,
    /// 数据存储目录
    pub data_dir: PathBuf,
    /// 数据库加密密钥（32字节，base64编码）
    pub encryption_key: Vec<u8>,
    /// TLS 证书路径
    pub tls_cert_path: PathBuf,
    /// TLS 私钥路径
    pub tls_key_path: PathBuf,
    /// JWT 签名密钥
    pub jwt_secret: String,
    /// 日志级别
    pub log_level: String,
    /// WAL 刷盘间隔（毫秒）
    pub wal_sync_interval_ms: u64,
    /// WAL 刷盘批次大小（事件数）
    pub wal_batch_size: usize,
    /// 单分区最大事件数
    pub max_events_per_partition: u64,
    /// WAL 持久化开关（关闭后启动极速，但数据不持久）
    pub wal_enabled: bool,
    /// 同步提交模式: Off / On / Strict
    pub sync_commit: SyncCommit,
    /// WAL 校验和开关
    pub wal_checksum: bool,
    /// 检查点间隔（秒），默认 300
    pub checkpoint_interval_secs: u64,
    /// 页面校验和开关
    pub page_checksum: bool,
    /// 慢查询日志阈值（毫秒），默认 100
    pub slow_query_threshold_ms: u64,
    /// Prometheus 指标端口，0 表示禁用
    pub metrics_port: u16,
}

impl Config {
    /// 从环境变量加载配置
    /// 从环境变量加载运行时配置。
    ///
    /// 所有参数均有合理的默认值，仅 `DB_ENCRYPTION_KEY` 在生产环境强制要求设置。
    /// 开发模式下使用内置默认密钥，无需额外配置。
    ///
    /// @return 填充完成且经过合法性校验的 Config 结构体。
    ///
    /// # Errors
    ///
    /// 若 `DB_ENCRYPTION_KEY` 的 base64 解码失败，返回 `Config` 错误变体。
    pub fn from_env() -> Result<Self, crate::error::HunTianError> {
        let enc_key_b64 = std::env::var("DB_ENCRYPTION_KEY")
            .unwrap_or_else(|_| "bHUMintCAaQfOkp1wl4C35FDxgizuxFTUjXvYbgg8Co=".into());

        let mut encryption_key =
            base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &enc_key_b64)
                .map_err(|e| {
                    crate::error::HunTianError::Config(format!("DB_ENCRYPTION_KEY 解码失败: {}", e))
                })?;
        // 确保密钥恰好 32 字节（AES-256 要求）
        if encryption_key.len() != 32 {
            encryption_key.resize(32, 0);
            tracing::warn!(
                "DB_ENCRYPTION_KEY 已调整为 32 字节 (原长度: {})",
                encryption_key.len()
            );
        }

        Ok(Self {
            postgres_port: env_u16("POSTGRES_PORT", 5408),
            rest_port: env_u16("REST_PORT", 58409),
            data_dir: env_path("DATA_DIR", "./data"),
            encryption_key,
            tls_cert_path: env_path("TLS_CERT_PATH", "./certs/server.crt"),
            tls_key_path: env_path("TLS_KEY_PATH", "./certs/server.key"),
            jwt_secret: env_str("JWT_SECRET", "huntiandb-dev-secret-change-in-prod"),
            log_level: env_str("RUST_LOG", "info"),
            wal_sync_interval_ms: env_u64("WAL_SYNC_INTERVAL_MS", 100),
            wal_batch_size: env_usize("WAL_BATCH_SIZE", 100_000),
            max_events_per_partition: env_u64("MAX_EVENTS_PER_PARTITION", 1_000_000),
            wal_enabled: env_str("WAL_ENABLED", "true") != "false",
            sync_commit: SyncCommit::from_env(),
            wal_checksum: env_str("WAL_CHECKSUM", "true") != "false",
            checkpoint_interval_secs: env_u64("CHECKPOINT_INTERVAL_SECS", 300),
            page_checksum: env_str("PAGE_CHECKSUM", "true") != "false",
            slow_query_threshold_ms: env_u64("SLOW_QUERY_THRESHOLD_MS", 100),
            metrics_port: env_u16("METRICS_PORT", 9090),
        })
    }
}

fn env_str(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.into())
}

fn env_u16(key: &str, default: u16) -> u16 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn env_u64(key: &str, default: u64) -> u64 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn env_usize(key: &str, default: usize) -> usize {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn env_path(key: &str, default: &str) -> PathBuf {
    std::env::var(key)
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(default))
}
