//! 混天DB 主程序入口
//!
//! 启动 PostgreSQL 线协议监听器和 REST API 服务。
//! 支持优雅关闭（SIGTERM/SIGINT）。

use std::sync::Arc;
use tokio::signal;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化日志
    huntiandb::metrics::logger::init_logger(false);

    tracing::info!("混天DB v{} 正在启动...", env!("CARGO_PKG_VERSION"));

    // 加载配置
    let config = huntiandb::config::Config::from_env()?;
    tracing::info!("配置已加载, 数据目录: {}", config.data_dir.display());

    // 初始化加密管理器
    let enc_manager = huntiandb::auth::encryption::EncryptionManager::new(&config.encryption_key);
    tracing::info!("AES-256-GCM 加密管理器已初始化");

    // 初始化存储引擎
    let ring_buffer = Arc::new(
        huntiandb::storage::RingBuffer::new(1_000_000) // 1M 容量
    );
    let wal = Arc::new(
        huntiandb::storage::WriteAheadLog::new(
            &config.encryption_key,
            config.data_dir.join("wal"),
            config.wal_sync_interval_ms,
            config.wal_batch_size,
        )?
    );
    tracing::info!("存储引擎已初始化 (RingBuffer 1M, WAL ready)");

    // 启动 PostgreSQL 监听器（后台任务）
    let pg_listener = huntiandb::server::listener::TlsListener::new(config.clone()).await?;
    let pg_handle = tokio::spawn(async move {
        if let Err(e) = pg_listener.listen().await {
            tracing::error!("PostgreSQL 监听器异常: {}", e);
        }
    });

    // 启动 REST API（后台任务）
    let api_state = Arc::new(huntiandb::server::rest_handler::ApiState {
        config: Arc::new(config.clone()),
    });
    let api_router = huntiandb::server::rest_handler::build_router(api_state);

    let rest_addr = format!("0.0.0.0:{}", config.rest_port);
    let rest_listener = tokio::net::TcpListener::bind(&rest_addr).await?;
    tracing::info!("REST API 监听器启动: {}", rest_addr);

    let rest_handle = tokio::spawn(async move {
        axum::serve(rest_listener, api_router).await
            .map_err(|e| tracing::error!("REST 服务异常: {}", e))
            .ok();
    });

    tracing::info!("混天DB 启动完成 — PG:{}, REST:{}", config.postgres_port, config.rest_port);
    tracing::info!("可用 psql -h localhost -p {} 连接", config.postgres_port);

    // 优雅关闭
    signal::ctrl_c().await?;
    tracing::info!("收到关闭信号，正在优雅退出...");

    pg_handle.abort();
    rest_handle.abort();

    tracing::info!("混天DB 已关闭");
    Ok(())
}
