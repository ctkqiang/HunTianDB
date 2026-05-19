//! 混天DB 结构化日志
//!
//! 自定义格式: [时间] [级别] [线程] 模块: 消息

use tracing_subscriber::fmt::format::FmtSpan;
use tracing_subscriber::{fmt, EnvFilter};

pub fn init_logger(json_output: bool) {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    if json_output {
        fmt().with_env_filter(env_filter).json().init();
    } else {
        fmt()
            .with_env_filter(env_filter)
            .with_target(false)
            .with_thread_ids(false)
            .with_thread_names(true)
            .with_file(false)
            .with_line_number(false)
            .with_span_events(FmtSpan::NONE)
            .with_timer(fmt::time::SystemTime)
            .compact()
            .init();
    }

    tracing::info!("混天DB 日志系统就绪");
}
