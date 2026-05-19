//! 配置加载器
//!
//! 从环境变量加载所有运行时配置，提供合理的默认值。

use std::path::PathBuf;

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
}

impl Config {
    /// 从环境变量加载配置
    ///
    /// # Errors
    ///
    /// 如果 `DB_ENCRYPTION_KEY` 未设置或无效 base64，返回错误。
    pub fn from_env() -> Result<Self, crate::error::HunTianError> {
        let enc_key_b64 = std::env::var("DB_ENCRYPTION_KEY")
            .map_err(|_| crate::error::HunTianError::Config(
                "DB_ENCRYPTION_KEY 环境变量未设置".into()
            ))?;

        let encryption_key = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            &enc_key_b64,
        ).map_err(|e| crate::error::HunTianError::Config(
            format!("DB_ENCRYPTION_KEY 解码失败: {}", e)
        ))?;

        Ok(Self {
            postgres_port: env_u16("POSTGRES_PORT", 5408),
            rest_port: env_u16("REST_PORT", 5000),
            data_dir: env_path("DATA_DIR", "./data"),
            encryption_key,
            tls_cert_path: env_path("TLS_CERT_PATH", "./certs/server.crt"),
            tls_key_path: env_path("TLS_KEY_PATH", "./certs/server.key"),
            jwt_secret: env_str("JWT_SECRET", "huntiandb-dev-secret-change-in-prod"),
            log_level: env_str("RUST_LOG", "info"),
            wal_sync_interval_ms: env_u64("WAL_SYNC_INTERVAL_MS", 100),
            wal_batch_size: env_usize("WAL_BATCH_SIZE", 100_000),
            max_events_per_partition: env_u64("MAX_EVENTS_PER_PARTITION", 1_000_000),
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
