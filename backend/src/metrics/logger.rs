//! 混天DB 日志 — Spring Boot 风格
//!
//! ASCII Art 品牌横幅 + RFC3339 + 线程名 + 启动诊断

use tracing_subscriber::fmt::format::FmtSpan;
use tracing_subscriber::{fmt, EnvFilter};

pub fn init_logger(json_output: bool) {
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

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

    print_banner();
}

fn print_banner() {
    let v = env!("CARGO_PKG_VERSION");
    let b = |s: &str| tracing::info!("{}", s);
    b("");
    b("  ╔══════════════════════════════════════════════════════════╗");
    b("  ║                                                          ║");
    b("  ║     ██╗  ██╗██╗   ██╗███╗   ██╗████████╗██╗ █████╗       ║");
    b("  ║     ██║  ██║██║   ██║████╗  ██║╚══██╔══╝██║██╔══██╗      ║");
    b("  ║     ███████║██║   ██║██╔██╗ ██║   ██║   ██║███████║      ║");
    b("  ║     ██╔══██║██║   ██║██║╚██╗██║   ██║   ██║██╔══██║      ║");
    b("  ║     ██║  ██║╚██████╔╝██║ ╚████║   ██║   ██║██║  ██║      ║");
    b("  ║     ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚═╝╚═╝  ╚═╝      ║");
    b("  ║                                                          ║");
    b(&format!(
        "  ║          混天 HunTianDB  v{:<12}                 ║",
        v
    ));
    b("  ║          时序安全数据库 · Timeseries Security DB          ║");
    b("  ║                                                          ║");
    b("  ╚══════════════════════════════════════════════════════════╝");
    b("");
}
