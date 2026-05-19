//! REST API 处理器
//!
//! 在端口 5000 上提供 HTTP REST 接口，
//! 供 React Portal 前端调用。
//! 基于 axum + tower。

use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::config::Config;

/// REST API 应用状态
pub struct ApiState {
    pub config: Arc<Config>,
}

/// 健康检查响应
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    uptime_seconds: u64,
}

/// 查询请求体
#[derive(Deserialize)]
struct QueryRequest {
    sql: String,
    params: Option<Vec<String>>,
}

/// 查询响应体
#[derive(Serialize)]
struct QueryResponse {
    columns: Vec<String>,
    rows: Vec<Vec<serde_json::Value>>,
    elapsed_ms: f64,
}

/// 构建 REST API 路由
pub fn build_router(state: Arc<ApiState>) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/api/query", post(query_handler))
        .route("/api/snapshots", get(snapshots_handler))
        .with_state(state)
}

/// GET /health — 健康检查
async fn health_handler(State(state): State<Arc<ApiState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        uptime_seconds: 0,
    })
}

/// POST /api/query — 执行 SQL 查询
async fn query_handler(
    State(state): State<Arc<ApiState>>,
    Json(req): Json<QueryRequest>,
) -> Result<Json<QueryResponse>, (StatusCode, String)> {
    tracing::info!("查询请求: {}", req.sql);

    // 占位实现 — 后续连接真实查询引擎
    Ok(Json(QueryResponse {
        columns: vec!["id".into(), "timestamp".into(), "event_type".into()],
        rows: vec![],
        elapsed_ms: 0.0,
    }))
}

/// GET /api/snapshots — 获取快照列表
async fn snapshots_handler(
    State(state): State<Arc<ApiState>>,
) -> Json<Vec<String>> {
    Json(vec![])
}
