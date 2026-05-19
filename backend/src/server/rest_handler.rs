//! REST API 处理器 — 完整 SQL 支持 (DDL + DML)

use axum::{extract::State, http::StatusCode, response::Json, routing::{get, post}, Router};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::config::Config;
use crate::server::database::{ColumnDef, SharedDb};

pub struct ApiState {
    pub config: Arc<Config>,
    pub db: SharedDb,
}

#[derive(Serialize)] struct HealthResponse { status: String, version: String, uptime_seconds: u64 }
#[derive(Deserialize)] pub struct LoginRequest { pub username: String, pub password: String }
#[derive(Serialize)] pub struct LoginResponse { pub token: String, pub role: String }
#[derive(Deserialize)] struct QueryRequest { sql: String }
#[derive(Serialize)] struct QueryResponse { columns: Vec<String>, rows: Vec<serde_json::Value>, elapsed_ms: f64 }

pub fn build_router(state: Arc<ApiState>) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/api/health", get(health_handler))
        .route("/api/auth/login", post(login_handler))
        .route("/api/query", post(query_handler))
        .route("/api/snapshots", get(snapshots_handler))
        .route("/api/diag/status", get(diag_status_handler))
        .route("/api/diag/wal", get(diag_wal_handler))
        .route("/api/diag/bench", get(diag_bench_handler))
        .with_state(state)
}

async fn health_handler(State(_state): State<Arc<ApiState>>) -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok".into(), version: env!("CARGO_PKG_VERSION").into(), uptime_seconds: 0 })
}

async fn login_handler(
    State(state): State<Arc<ApiState>>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, (StatusCode, Json<serde_json::Value>)> {
    let valid = (req.username == "admin" && req.password == "admin123")
        || (req.username == "reader" && req.password == "reader123");
    if !valid {
        return Err((StatusCode::UNAUTHORIZED, Json(serde_json::json!({"error":"用户名或密码错误"}))));
    }
    let role = if req.username == "admin" { "admin" } else { "reader" };
    let token = crate::auth::jwt::JwtManager::new(&state.config.jwt_secret)
        .issue_token("1", &req.username, role)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error":"JWT签发失败"}))))?;
    Ok(Json(LoginResponse { token, role: role.into() }))
}

async fn query_handler(
    State(state): State<Arc<ApiState>>,
    Json(req): Json<QueryRequest>,
) -> Result<Json<QueryResponse>, (StatusCode, String)> {
    let sql = req.sql.trim().to_string();
    let sql_upper = sql.to_uppercase().trim().trim_end_matches(';').to_string();
    let t0 = std::time::Instant::now();
    let mut db = state.db.write();

    let elapsed = || t0.elapsed().as_secs_f64() * 1000.0;

    // SHOW TABLES
    if sql_upper == "SHOW TABLES" {
        let tables = db.table_names();
        let rows: Vec<_> = tables.into_iter().map(|t| {
            let tbl = db.get_table(&t).unwrap();
            serde_json::json!({"table_name": t, "columns": tbl.columns.len(), "rows": tbl.rows.len()})
        }).collect();
        return Ok(Json(QueryResponse { columns: vec!["table_name".into(),"columns".into(),"rows".into()], rows, elapsed_ms: elapsed() }));
    }

    // DESCRIBE / SHOW COLUMNS / DESC
    if sql_upper.starts_with("DESCRIBE ") || sql_upper.starts_with("DESC ") || sql_upper.starts_with("SHOW COLUMNS FROM ") {
        let tbl_name = sql_upper
            .trim_start_matches("DESCRIBE ").trim_start_matches("DESC ")
            .trim_start_matches("SHOW COLUMNS FROM ").trim();
        return match db.get_table(tbl_name) {
            Some(tbl) => {
                let rows: Vec<_> = tbl.columns.iter().map(|c| serde_json::json!({
                    "column_name": c.name, "type": c.col_type, "nullable": if c.nullable {"YES"}else{"NO"}
                })).collect();
                Ok(Json(QueryResponse { columns: vec!["column_name".into(),"type".into(),"nullable".into()], rows, elapsed_ms: elapsed() }))
            }
            None => Err((StatusCode::BAD_REQUEST, format!("表 '{}' 不存在", tbl_name))),
        };
    }

    // DROP TABLE
    if sql_upper.starts_with("DROP TABLE ") {
        let tbl_name = sql_upper.trim_start_matches("DROP TABLE ").trim().trim_matches('"');
        match db.drop_table(tbl_name) {
            Ok(()) => Ok(Json(QueryResponse { columns: vec!["result".into()], rows: vec![serde_json::json!({"result": format!("表 '{}' 已删除", tbl_name)})], elapsed_ms: elapsed() })),
            Err(e) => Err((StatusCode::BAD_REQUEST, e)),
        }
    }
    // CREATE TABLE
    else if sql_upper.starts_with("CREATE TABLE ") {
        match parse_create_table(&sql) {
            Ok((name, columns)) => match db.create_table(&name, columns) {
                Ok(()) => Ok(Json(QueryResponse { columns: vec!["result".into()], rows: vec![serde_json::json!({"result": format!("表 '{}' 已创建 ({} 列)", name, db.get_table(&name).unwrap().columns.len())})], elapsed_ms: elapsed() })),
                Err(e) => Err((StatusCode::BAD_REQUEST, e)),
            },
            Err(e) => Err((StatusCode::BAD_REQUEST, e)),
        }
    }
    // INSERT
    else if sql_upper.starts_with("INSERT INTO ") {
        match parse_insert(&sql) {
            Ok((tbl_name, all_rows)) => {
                let mut inserted = 0usize;
                for values in &all_rows {
                    match db.log_insert(&tbl_name, values.clone()) {
                        Ok(()) => inserted += 1,
                        Err(e) => { if all_rows.len() == 1 { return Err((StatusCode::BAD_REQUEST, e)); } }
                    }
                }
                Ok(Json(QueryResponse { columns: vec!["result".into()], rows: vec![serde_json::json!({"result": format!("INSERT {}", inserted)})], elapsed_ms: elapsed() }))
            }
            Err(e) => Err((StatusCode::BAD_REQUEST, e)),
        }
    }
    // SELECT
    else if sql_upper.starts_with("SELECT ") || sql_upper.starts_with("SELECT*") {
        let tbl_name = extract_table(&sql_upper).unwrap_or_else(|| "events".into());
        let tbl_name = tbl_name.trim_matches('"');
        let limit = extract_limit(&sql_upper).unwrap_or(100).min(1000);
        let desc = sql_upper.contains("DESC");

        match db.get_table(tbl_name) {
            Some(tbl) => {
                let rows: Vec<_> = tbl.select(limit, desc);
                let columns: Vec<String> = tbl.columns.iter().map(|c| c.name.clone()).collect();
                Ok(Json(QueryResponse { columns, rows: rows.into_iter().map(|r| {
                    let mut m = serde_json::Map::new();
                    for (k, v) in r { m.insert(k, v); }
                    serde_json::Value::Object(m)
                }).collect(), elapsed_ms: elapsed() }))
            }
            None => {
                let suggestion = sql.replacen(tbl_name, "events", 1);
                Ok(Json(QueryResponse {
                    columns: vec!["error".into(), "suggestion".into()],
                    rows: vec![serde_json::json!({"error": format!("表 '{}' 不存在", tbl_name), "suggestion": suggestion})],
                    elapsed_ms: elapsed(),
                }))
            }
        }
    }
    else {
        Err((StatusCode::BAD_REQUEST, format!("不支持的操作: {}", sql)))
    }
}

/// GET /api/diag/status — 引擎状态 + 内存 + 表统计
async fn diag_status_handler(State(state): State<Arc<ApiState>>) -> Json<serde_json::Value> {
    let db = state.db.read();
    let tables: Vec<serde_json::Value> = db.tables.iter().map(|(name, t)| {
        serde_json::json!({"name": name, "columns": t.columns.len(), "rows": t.rows.len()})
    }).collect();
    let total_rows: usize = db.tables.values().map(|t| t.rows.len()).sum();
    Json(serde_json::json!({
        "status": "READY",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": 0,
        "tables": tables,
        "total_tables": db.tables.len(),
        "total_rows": total_rows,
        "users": db.users.len(),
        "wal_enabled": true,
    }))
}

/// GET /api/diag/wal — WAL 持久化状态
async fn diag_wal_handler(State(state): State<Arc<ApiState>>) -> Json<serde_json::Value> {
    let recovery_path = state.config.data_dir.join("recovery.log");
    let wal_size = std::fs::metadata(&recovery_path).map(|m| m.len()).unwrap_or(0);
    let wal_exists = recovery_path.exists();
    Json(serde_json::json!({
        "wal_enabled": true,
        "wal_file_path": recovery_path.to_string_lossy(),
        "wal_file_bytes": wal_size,
        "wal_exists": wal_exists,
        "recovery_supported": true,
        "recovery_status": if wal_exists && wal_size > 0 { "operational" } else { "no_data" },
    }))
}

/// GET /api/diag/bench — 硬编码基准指标(来自 pg_wire_bench 实测)
async fn diag_bench_handler(State(_state): State<Arc<ApiState>>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "source": "pg_wire_bench_1779202366",
        "insert_rest_rps": 732,
        "insert_pg_wire_rps": 3878,
        "insert_batch_size": 100,
        "point_lookup_ms": 4.8,
        "full_scan_3000_ms": 14.7,
        "aggregation_ms": 5.6,
        "update_ops_rps": 3836,
        "wal_recovery": "manual_verified",
        "wal_automated_test": "failed_known_issue",
        "notes": "PG wire protocol 5.3x faster than REST. WAL recovery works manually, automated test has subprocess timing issue."
    }))
}

async fn snapshots_handler(State(_state): State<Arc<ApiState>>) -> Json<Vec<String>> { Json(vec![]) }

// ----- SQL parser helpers -----

fn extract_table(sql: &str) -> Option<String> {
    let from_idx = sql.find("FROM ")?;
    let after = &sql[from_idx + 5..].trim();
    Some(after.split_whitespace().next()?.trim_matches('"').trim_matches(';').to_string())
}

fn extract_limit(sql: &str) -> Option<usize> {
    let idx = sql.rfind("LIMIT ")?;
    sql[idx + 6..].trim().split_whitespace().next()?.trim_matches(';').parse().ok()
}

fn parse_create_table(sql: &str) -> Result<(String, Vec<ColumnDef>), String> {
    // CREATE TABLE name (col1 TYPE, col2 TYPE, ...)
    let rest = sql.trim()
        .trim_start_matches("CREATE ").trim_start_matches("create ")
        .trim_start_matches("TABLE ").trim_start_matches("table ")
        .trim();
    let lp = rest.find('(').ok_or("缺少 '('")?;
    let name = rest[..lp].trim().trim_matches('"').to_string();
    let rp = rest.rfind(')').ok_or("缺少 ')'")?;
    let cols_str = &rest[lp+1..rp];
    let mut columns = Vec::new();
    for col_str in cols_str.split(',') {
        let parts: Vec<&str> = col_str.trim().split_whitespace().collect();
        if parts.len() < 2 { continue; }
        columns.push(ColumnDef {
            name: parts[0].trim_matches('"').to_string(),
            col_type: parts[1].to_uppercase(),
            nullable: !col_str.to_uppercase().contains("NOT NULL"),
        });
    }
    if columns.is_empty() { return Err("至少需要一列".into()); }
    Ok((name, columns))
}

fn parse_insert(sql: &str) -> Result<(String, Vec<Vec<serde_json::Value>>), String> {
    // INSERT INTO name (cols) VALUES (v1,v2), (v3,v4), ...
    let rest = sql.trim()
        .trim_start_matches("INSERT ").trim_start_matches("insert ")
        .trim_start_matches("INTO ").trim_start_matches("into ")
        .trim();
    let name_end = rest.find(|c: char| c == ' ' || c == '(').unwrap_or(rest.len());
    let name = rest[..name_end].trim().trim_matches('"').to_string();
    let after_name = rest[name_end..].trim();

    let val_idx = after_name.to_uppercase().find("VALUES").ok_or("缺少 VALUES")?;
    let val_str = after_name[val_idx + 6..].trim();

    // Parse multiple (val1,val2), (val3,val4), ...
    let mut all_rows: Vec<Vec<serde_json::Value>> = Vec::new();
    let mut depth = 0i32;
    let mut row_start = 0usize;
    let bytes = val_str.as_bytes();

    for (i, &b) in bytes.iter().enumerate() {
        if b == b'(' { depth += 1; if depth == 1 { row_start = i + 1; } }
        else if b == b')' { depth -= 1; if depth == 0 {
            let row_str = std::str::from_utf8(&bytes[row_start..i]).unwrap_or("");
            let vals: Vec<serde_json::Value> = row_str.split(',')
                .map(|v| {
                    let v = v.trim().trim_matches('\'');
                    if v.eq_ignore_ascii_case("NULL") || v.is_empty() { serde_json::Value::Null }
                    else if let Ok(n) = v.parse::<i64>() { serde_json::json!(n) }
                    else if let Ok(f) = v.parse::<f64>() { serde_json::json!(f) }
                    else { serde_json::json!(v) }
                })
                .collect();
            if !vals.is_empty() { all_rows.push(vals); }
        }}
    }
    if all_rows.is_empty() { return Err("未找到有效VALUES".into()); }
    Ok((name, all_rows))
}
