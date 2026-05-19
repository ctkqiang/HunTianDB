//! 结构化日志配置
//!
//! 基于 `tracing-subscriber`，支持 JSON 格式输出到 stdout。

use tracing_subscriber::{fmt, EnvFilter};

/// 初始化日志系统
///
/// 从环境变量 `RUST_LOG` 读取日志级别过滤。
/// 输出格式: 紧凑文本（开发模式）或 JSON（生产模式）。
pub fn init_logger(json_output: bool) {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    let builder = fmt()
        .with_env_filter(env_filter)
        .with_target(true)
        .with_thread_ids(true);

    if json_output {
        builder.json().init();
    } else {
        builder.compact().init();
    }

    tracing::info!("混天DB 日志系统已初始化");
}
