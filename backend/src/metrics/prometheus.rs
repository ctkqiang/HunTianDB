//! Prometheus 指标导出
//!
//! 通过 HTTP 端点暴露应用指标。
//! 指标包括:
//! - 写入吞吐量 (events/sec)
//! - 查询延迟 (P50/P95/P99)
//! - 活跃连接数
//! - WAL 大小

use prometheus::{
    IntCounter, IntGauge, Histogram, Registry,
    register_int_counter, register_int_gauge, register_histogram,
};

/// 应用指标集合
pub struct AppMetrics {
    /// 写入事件总数
    pub events_written: IntCounter,
    /// 查询执行次数
    pub queries_executed: IntCounter,
    /// 活跃连接数
    pub active_connections: IntGauge,
    /// WAL 当前大小（字节）
    pub wal_size_bytes: IntGauge,
    /// 查询延迟直方图（毫秒）
    pub query_latency_ms: Histogram,
}

impl AppMetrics {
    /// 创建并注册所有指标
    pub fn new() -> Result<Self, prometheus::Error> {
        Ok(Self {
            events_written: register_int_counter!(
                "huntiandb_events_written_total",
                "写入事件总数"
            )?,
            queries_executed: register_int_counter!(
                "huntiandb_queries_executed_total",
                "查询执行次数"
            )?,
            active_connections: register_int_gauge!(
                "huntiandb_active_connections",
                "活跃连接数"
            )?,
            wal_size_bytes: register_int_gauge!(
                "huntiandb_wal_size_bytes",
                "WAL 文件大小（字节）"
            )?,
            query_latency_ms: register_histogram!(
                "huntiandb_query_latency_ms",
                "查询延迟（毫秒）",
                vec![1.0, 5.0, 10.0, 25.0, 50.0, 100.0, 250.0, 500.0, 1000.0]
            )?,
        })
    }
}
