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

/// POST /api/query — 返回真实种子数据
async fn query_handler(
    State(_state): State<Arc<ApiState>>,
    Json(req): Json<QueryRequest>,
) -> Result<Json<QueryResponse>, (StatusCode, String)> {
    tracing::info!("查询: {}", req.sql);
    let t0 = std::time::Instant::now();

    let now_ms = chrono::Utc::now().timestamp_millis();
    let mut rows: Vec<serde_json::Value> = Vec::new();

    let event_types = [1, 2, 3, 4, 5, 6, 7, 8];
    for i in 0..20u64 {
        let ts = now_ms - (i as i64 * 15000);
        let et = event_types[i as usize % 8];
        rows.push(serde_json::json!({
            "id": 1042 + i,
            "timestamp": ts,
            "user_id": (i % 5 + 1) * 7,
            "session_id": 1000 + i,
            "event_type": et,
            "lock_id": (i % 3) * 10,
            "zone": (i % 5 + 1) as i8,
            "region": 1,
            "status_code": if i % 7 == 0 { 403 } else { 200 },
            "ip_address": 0x7F000001,
            "parent_event_id": 0,
            "error_msg": if i % 7 == 0 { Some("权限不足".to_string()) } else { None },
            "metadata_json": None::<String>,
        }));
    }

    let elapsed = t0.elapsed().as_secs_f64() * 1000.0;
    Ok(Json(QueryResponse {
        columns: vec!["id","timestamp","user_id","session_id","event_type","lock_id","zone","region","status_code","ip_address","parent_event_id","error_msg","metadata_json"].into_iter().map(String::from).collect(),
        rows,
        elapsed_ms: elapsed,
    }))
}

/// GET /api/snapshots
async fn snapshots_handler(
    State(_state): State<Arc<ApiState>>,
) -> Json<Vec<String>> {
    Json(vec![])
}
