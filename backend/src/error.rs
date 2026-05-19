//! 全局错误类型定义
//!
//! 使用 `thiserror` 派生宏定义所有错误类型，
//! 提供清晰的错误链与上下文信息。

use thiserror::Error;

/// 混天DB 顶层错误枚举
#[derive(Debug, Error)]
pub enum HunTianError {
    /// 配置加载失败
    #[error("配置错误: {0}")]
    Config(String),

    /// TLS/证书错误
    #[error("TLS错误: {0}")]
    Tls(String),

    /// 认证失败
    #[error("认证失败: {0}")]
    Auth(String),

    /// 权限不足
    #[error("权限不足: 需要 {required}, 当前 {current}")]
    Forbidden {
        required: String,
        current: String,
    },

    /// PostgreSQL 协议错误
    #[error("协议错误: {0}")]
    Protocol(String),

    /// SQL 解析/执行错误
    #[error("查询错误: {0}")]
    Query(String),

    /// 存储层 I/O 错误
    #[error("存储错误: {0}")]
    Storage(String),

    /// 数据损坏（校验和不匹配）
    #[error("数据完整性错误: {0}")]
    Integrity(String),

    /// 资源耗尽
    #[error("资源耗尽: {0}")]
    ResourceExhausted(String),

    /// 内部错误（不应发生）
    #[error("内部错误: {0}")]
    Internal(String),
}

/// 便捷类型别名
pub type HunTianResult<T> = Result<T, HunTianError>;

// 从标准I/O错误转换
impl From<std::io::Error> for HunTianError {
    fn from(e: std::io::Error) -> Self {
        HunTianError::Storage(e.to_string())
    }
}

// 从Parquet错误转换
impl From<parquet::errors::ParquetError> for HunTianError {
    fn from(e: parquet::errors::ParquetError) -> Self {
        HunTianError::Storage(format!("Parquet: {}", e))
    }
}

// 从Arrow错误转换
impl From<arrow::error::ArrowError> for HunTianError {
    fn from(e: arrow::error::ArrowError) -> Self {
        HunTianError::Storage(format!("Arrow: {}", e))
    }
}

// 从JSON序列化错误转换
impl From<serde_json::Error> for HunTianError {
    fn from(e: serde_json::Error) -> Self {
        HunTianError::Internal(format!("序列化错误: {}", e))
    }
}
