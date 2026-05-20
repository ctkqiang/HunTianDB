//! 慢查询日志 — 生产诊断工具
//!
//! 超过配置阈值的查询写入 slow.log，含时间戳、SQL 文本、耗时、客户端 IP。

use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use chrono::Utc;

/// 慢查询记录器
pub struct SlowQueryLog {
    path: PathBuf,
    threshold_ms: u64,
    writer: Mutex<std::fs::File>,
}

impl SlowQueryLog {
    /// 创建慢查询日志。若文件不存在则创建。
    pub fn new(data_dir: &std::path::Path, threshold_ms: u64) -> std::io::Result<Self> {
        let path = data_dir.join("slow.log");
        let file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)?;
        tracing::info!(?path, threshold_ms, "慢查询日志已启用");
        Ok(Self { path, threshold_ms, writer: Mutex::new(file) })
    }

    /// 记录一条慢查询（若 duration_ms >= threshold）。
    pub fn log_if_slow(&self, sql: &str, duration_ms: f64, client_addr: &str) {
        if duration_ms < self.threshold_ms as f64 { return; }
        let ts = Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ");
        let line = format!(
            "[{}] {}ms {} | {}\n",
            ts,
            (duration_ms * 1000.0).round() / 1000.0,
            client_addr,
            sql.trim().replace('\n', " "),
        );
        if let Ok(mut w) = self.writer.lock() {
            let _ = w.write_all(line.as_bytes());
            let _ = w.flush();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_slow_query_log() {
        let tmp = TempDir::new().unwrap();
        let log = SlowQueryLog::new(tmp.path(), 50).unwrap();
        // 低于阈值 — 不记录
        log.log_if_slow("SELECT 1", 10.0, "127.0.0.1");
        // 高于阈值 — 记录
        log.log_if_slow("SELECT * FROM events", 200.0, "10.0.0.1");

        let content = std::fs::read_to_string(tmp.path().join("slow.log")).unwrap();
        assert!(content.contains("200ms"));
        assert!(content.contains("SELECT * FROM events"));
        assert!(content.contains("10.0.0.1"));
        assert!(!content.contains("SELECT 1"));
    }
}
