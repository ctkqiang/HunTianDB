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
    let _enc_manager = huntiandb::auth::encryption::EncryptionManager::new(&config.encryption_key);
    tracing::info!("AES-256-GCM 加密管理器已初始化");

    // 初始化存储引擎
    let _ring_buffer = Arc::new(
        huntiandb::storage::RingBuffer::new(1_000_000), // 1M 容量
    );
    let _wal = Arc::new(huntiandb::storage::WriteAheadLog::new(
        &config.encryption_key,
        config.data_dir.join("wal"),
        config.wal_sync_interval_ms,
        config.wal_batch_size,
    )?);
    tracing::info!("存储引擎已初始化 (RingBuffer 1M, WAL ready)");

    // 初始化内存数据库引擎
    let db = Arc::new(parking_lot::RwLock::new(
        huntiandb::server::database::Database::new(config.data_dir.clone(), config.wal_enabled),
    ));
    tracing::info!("数据库引擎已初始化");

    // 启动 PostgreSQL 线协议监听器（明文TCP，端口5408）
    let pg_port = config.postgres_port;
    let pg_db = db.clone();
    let pg_handle = tokio::spawn(async move {
        let addr = format!("0.0.0.0:{}", pg_port);
        let socket = tokio::net::TcpSocket::new_v4().unwrap();
        socket.set_reuseaddr(true).unwrap();
        socket.bind(addr.parse().unwrap()).unwrap();
        let listener = socket.listen(1024).unwrap();
        tracing::info!("PostgreSQL WIRE 线协议监听: {} (明文, SO_REUSEADDR)", addr);
        loop {
            let (stream, peer) = listener.accept().await.unwrap();
            let db = pg_db.clone();
            tokio::spawn(async move {
                let mut proto =
                    huntiandb::server::postgres_protocol::PostgresProtocol::new(stream, db.clone());
                if let Err(e) = proto.handle_connection().await {
                    tracing::debug!("WIRE 连接结束 ({}): {}", peer, e);
                }
            });
        }
    });

    // 启动 REST API（后台任务）
    let api_state = Arc::new(huntiandb::server::rest_handler::ApiState {
        config: Arc::new(config.clone()),
        db,
    });
    let api_router = huntiandb::server::rest_handler::build_router(api_state);

    // CORS 层 — 允许前端跨域访问
    let cors = tower_http::cors::CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any);
    let api_router = api_router.layer(cors);

    let rest_addr = format!("0.0.0.0:{}", config.rest_port);
    let rest_socket = tokio::net::TcpSocket::new_v4().unwrap();
    rest_socket.set_reuseaddr(true).unwrap();
    rest_socket.bind(rest_addr.parse().unwrap()).unwrap();
    let rest_listener = rest_socket.listen(1024).unwrap();
    tracing::info!("REST API 监听器启动: {} (SO_REUSEADDR)", rest_addr);

    let rest_handle = tokio::spawn(async move {
        axum::serve(rest_listener, api_router)
            .await
            .map_err(|e| tracing::error!("REST 服务异常: {}", e))
            .ok();
    });

    tracing::info!(
        "混天DB 启动完成 — PG:{}, REST:{}",
        config.postgres_port,
        config.rest_port
    );
    tracing::info!("可用 psql -h localhost -p {} 连接", config.postgres_port);

    // 优雅关闭
    signal::ctrl_c().await?;
    tracing::info!("收到关闭信号，正在优雅退出...");

    pg_handle.abort();
    rest_handle.abort();

    tracing::info!("混天DB 已关闭");
    Ok(())
}
