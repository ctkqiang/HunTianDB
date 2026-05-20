//! Prometheus 指标导出 — 生产级可观测性
//!
//! 指标端点默认在 :9090/metrics，可通过 PROMETHEUS_PORT / PROMETHEUS_PATH 配置。
//! 同时提供 /health 和 /ready 端点用于健康检查与就绪探针。
//!
//! 指标包括:
//! - 查询延迟直方图 (huntian_query_duration_seconds)
//! - WAL fsync 耗时直方图 (huntian_wal_fsync_seconds)
//! - WAL 大小 / LSN (huntian_wal_size_bytes, huntian_wal_replay_lsn)
//! - 内存 / 文件描述符 (huntian_memory_usage_bytes, huntian_open_fds)
//! - 活跃查询 / 慢查询 / 校验和失败 (counter/gauge)

use prometheus::{
    IntCounter, IntGauge, Histogram,
    register_int_counter, register_int_gauge, register_histogram,
    Encoder, TextEncoder,
};
use std::sync::OnceLock;

// ── 查询延迟直方图分桶 ──
const QUERY_LATENCY_BUCKETS: &[f64] = &[
    0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
];

// ── Fsync 耗时直方图分桶 ──
const FSYNC_DURATION_BUCKETS: &[f64] = &[
    0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1,
];

// ── 快照创建耗时直方图分桶 ──
const SNAPSHOT_DURATION_BUCKETS: &[f64] = &[
    0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0,
];

/// 生产级应用指标集合
pub struct AppMetrics {
    /// WAL fsync 耗时直方图
    pub wal_fsync_seconds: Histogram,
    /// WAL 文件当前大小（字节）
    pub wal_size_bytes: IntGauge,
    /// WAL 回放最后 LSN
    pub wal_replay_lsn: IntGauge,
    /// 进程内存使用量（字节）
    pub memory_usage_bytes: IntGauge,
    /// 打开的文件描述符数量
    pub open_fds: IntGauge,
    /// 当前活跃查询数
    pub active_queries: IntGauge,
    /// 慢查询总数
    pub slow_queries_total: IntCounter,
    /// 校验和失败总数
    pub checksum_failures_total: IntCounter,
    /// 快照创建耗时直方图
    pub snapshot_duration_seconds: Histogram,
    /// 查询延迟直方图
    pub query_duration_seconds: Histogram,
    /// 写入事件总数
    pub events_written: IntCounter,
    /// 查询执行次数
    pub queries_executed: IntCounter,
    /// 活跃连接数
    pub active_connections: IntGauge,
}

impl AppMetrics {
    /// 创建并注册所有指标
    pub fn new() -> Result<Self, prometheus::Error> {
        Ok(Self {
            wal_fsync_seconds: register_histogram!(
                "huntian_wal_fsync_seconds",
                "WAL fsync 耗时（秒）",
                FSYNC_DURATION_BUCKETS.to_vec()
            )?,

            wal_size_bytes: register_int_gauge!(
                "huntian_wal_size_bytes",
                "WAL 文件当前大小（字节）"
            )?,

            wal_replay_lsn: register_int_gauge!(
                "huntian_wal_replay_lsn",
                "WAL 回放过程中最后应用的 LSN"
            )?,

            memory_usage_bytes: register_int_gauge!(
                "huntian_memory_usage_bytes",
                "进程内存使用量（字节，RSS）"
            )?,

            open_fds: register_int_gauge!(
                "huntian_open_fds",
                "打开的文件描述符数量"
            )?,

            active_queries: register_int_gauge!(
                "huntian_active_queries",
                "当前正在执行的查询数"
            )?,

            slow_queries_total: register_int_counter!(
                "huntian_slow_queries_total",
                "慢查询总数"
            )?,

            checksum_failures_total: register_int_counter!(
                "huntian_checksum_failures_total",
                "WAL 或页面校验和不匹配次数"
            )?,

            snapshot_duration_seconds: register_histogram!(
                "huntian_snapshot_duration_seconds",
                "快照创建耗时（秒）",
                SNAPSHOT_DURATION_BUCKETS.to_vec()
            )?,

            query_duration_seconds: register_histogram!(
                "huntian_query_duration_seconds",
                "查询执行耗时（秒）",
                QUERY_LATENCY_BUCKETS.to_vec()
            )?,

            events_written: register_int_counter!(
                "huntian_events_written_total",
                "写入事件总数"
            )?,

            queries_executed: register_int_counter!(
                "huntian_queries_executed_total",
                "查询执行次数"
            )?,

            active_connections: register_int_gauge!(
                "huntian_active_connections",
                "活跃连接数"
            )?,
        })
    }
}

// ── 系统指标采集（内存、FD） ──

/// 采集进程 RSS 内存（字节）
pub fn collect_memory_usage() -> i64 {
    #[cfg(target_os = "linux")]
    {
        if let Ok(data) = std::fs::read_to_string("/proc/self/status") {
            for line in data.lines() {
                if line.starts_with("VmRSS:") {
                    return line
                        .split_whitespace()
                        .nth(1)
                        .and_then(|s| s.parse::<i64>().ok())
                        .map(|kb| kb * 1024)
                        .unwrap_or(-1);
                }
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        // macOS: 使用 libc 获取 RSS
        unsafe {
            let mut info: libc::mach_task_basic_info = std::mem::zeroed();
            let mut count = libc::MACH_TASK_BASIC_INFO_COUNT;
            let r = libc::task_info(
                libc::mach_task_self(),
                libc::MACH_TASK_BASIC_INFO,
                &mut info as *mut _ as *mut libc::integer_t,
                &mut count,
            );
            if r == libc::KERN_SUCCESS {
                return info.resident_size as i64;
            }
        }
    }
    0
}

/// 采集打开的文件描述符数量
pub fn collect_open_fds() -> i64 {
    #[cfg(target_os = "linux")]
    {
        if let Ok(dir) = std::fs::read_dir("/proc/self/fd") {
            return dir.count() as i64;
        }
    }
    #[cfg(target_os = "macos")]
    {
        unsafe {
            let mut count: libc::c_int = 0;
            let tablesize: libc::c_int = libc::getdtablesize();
            for fd in 0..tablesize {
                if libc::fcntl(fd, libc::F_GETFD) != -1 {
                    count += 1;
                }
            }
            return count as i64;
        }
    }
    0
}

// ── HTTP 指标服务 ──

static DB_READY: OnceLock<std::sync::atomic::AtomicBool> = OnceLock::new();

/// 检查数据库是否已完成恢复并准备好接受查询
pub fn is_ready() -> bool {
    DB_READY
        .get_or_init(|| std::sync::atomic::AtomicBool::new(false))
        .load(std::sync::atomic::Ordering::Acquire)
}

/// 标记数据库已完成恢复，准备接受查询
pub fn set_ready() {
    DB_READY
        .get_or_init(|| std::sync::atomic::AtomicBool::new(false))
        .store(true, std::sync::atomic::Ordering::Release);
}

/// 启动 Prometheus 指标 + 健康检查 HTTP 端点
///
/// 端点:
///   GET /metrics  — Prometheus 文本格式指标
///   GET /health   — 200 若服务运行中
///   GET /ready    — 200 若数据库已完成恢复并接受查询
pub async fn serve_metrics(port: u16, path: String) -> std::io::Result<()> {
    use axum::{routing::get, Router};
    use std::net::SocketAddr;

    let app = Router::new()
        .route("/health", get(|| async { "OK\n" }))
        .route("/ready", get(|| async {
            if is_ready() { "OK\n" } else { "NOT READY\n" }
        }))
        .route(&path, get(metrics_handler));

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(port, path, "Prometheus 指标端点已启动");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn metrics_handler() -> String {
    // 采集系统指标
    if let Ok(m) = AppMetrics::new() {
        m.memory_usage_bytes.set(collect_memory_usage());
        m.open_fds.set(collect_open_fds());
    }

    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = Vec::new();
    encoder.encode(&metric_families, &mut buffer).unwrap();
    String::from_utf8(buffer).unwrap_or_default()
}
