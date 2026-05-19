//! REST API 处理器 — 认证、查询、快照

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

pub struct ApiState {
    pub config: Arc<Config>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    uptime_seconds: u64,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub role: String,
}

#[derive(Deserialize)]
struct QueryRequest {
    sql: String,
    #[serde(default)]
    params: Option<Vec<String>>,
}

#[derive(Serialize)]
struct QueryResponse {
    columns: Vec<String>,
    rows: Vec<serde_json::Value>,
    elapsed_ms: f64,
}

/// 构建 REST API 路由
pub fn build_router(state: Arc<ApiState>) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/api/auth/login", post(login_handler))
        .route("/api/query", post(query_handler))
        .route("/api/snapshots", get(snapshots_handler))
        .with_state(state)
}

/// GET /health
async fn health_handler(State(_state): State<Arc<ApiState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        uptime_seconds: 0,
    })
}

/// POST /api/auth/login — 登录认证
///
/// 默认账号: admin / admin123 (开发模式)
/// 角色: admin (全权限)
async fn login_handler(
    State(_state): State<Arc<ApiState>>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, (StatusCode, Json<serde_json::Value>)> {
    // 开发模式: admin / admin123
    if req.username == "admin" && req.password == "admin123" {
        let token = crate::auth::jwt::JwtManager::new(&_state.config.jwt_secret)
            .issue_token("1", "admin", "admin")
            .map_err(|_| (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "JWT签发失败"})),
            ))?;

        return Ok(Json(LoginResponse { token, role: "admin".into() }));
    }

    // reader 账号: reader / reader123
    if req.username == "reader" && req.password == "reader123" {
        let token = crate::auth::jwt::JwtManager::new(&_state.config.jwt_secret)
            .issue_token("2", "reader", "reader")
            .map_err(|_| (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "JWT签发失败"})),
            ))?;

        return Ok(Json(LoginResponse { token, role: "reader".into() }));
    }

    Err((
        StatusCode::UNAUTHORIZED,
        Json(serde_json::json!({"error": "用户名或密码错误"})),
    ))
}

/// POST /api/query
async fn query_handler(
    State(_state): State<Arc<ApiState>>,
    Json(req): Json<QueryRequest>,
) -> Result<Json<QueryResponse>, (StatusCode, String)> {
    tracing::info!("查询请求: {}", req.sql);
    Ok(Json(QueryResponse {
        columns: vec!["id".into(), "timestamp".into(), "event_type".into()],
        rows: vec![],
        elapsed_ms: 0.0,
    }))
}

/// GET /api/snapshots
async fn snapshots_handler(
    State(_state): State<Arc<ApiState>>,
) -> Json<Vec<String>> {
    Json(vec![])
}
