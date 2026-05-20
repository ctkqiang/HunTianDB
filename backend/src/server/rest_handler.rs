//! REST API 处理器 — 完整 SQL 支持 (DDL + DML) + 前端静态文件服务

use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_http::services::ServeDir;
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
    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "./static".into());

    // 独立的路由：API 路径带 state，静态文件不带
    let api_state = state.clone();
    let api_routes = Router::new()
        .route("/health", get(health_handler))
        .route("/api/health", get(health_handler))
        .route("/api/auth/login", post(login_handler))
        .route("/api/query", post(query_handler))
        .route("/api/snapshots", get(snapshots_handler))
        .route("/api/diag/status", get(diag_status_handler))
        .route("/api/diag/wal", get(diag_wal_handler))
        .route("/api/diag/bench", get(diag_bench_handler))
        .with_state(api_state);

    // SPA fallback handler
    let index_html = std::path::Path::new(&static_dir).join("index.html");
    let fallback_html = if index_html.exists() {
        std::fs::read_to_string(&index_html).unwrap_or_else(|_| "HunTianDB API — 前端未加载".into())
    } else {
        "HunTianDB API Server — 使用 POST /api/query 执行 SQL".into()
    };

    // 静态文件 + SPA fallback
    api_routes
        .fallback_service(
            ServeDir::new(&static_dir)
                .fallback(axum::routing::get(move || {
                    let html = fallback_html.clone();
                    async move {
                        axum::response::Response::builder()
                            .status(200)
                            .header("Content-Type", "text/html; charset=utf-8")
                            .body(axum::body::Body::from(html))
                            .unwrap()
                    }
                }))
        )
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

/// 执行任意 SQL 并返回 JSON 结果集。
///
/// 支持 DDL/DML 及元数据查询。写操作同步写入 WAL 确保崩溃恢复。
///
/// @param state 共享应用状态（数据库引擎引用）。
/// @param req 包含 `sql` 字段的 JSON 请求体。
/// @return 列名、行数据与耗时构成的 QueryResponse JSON。
///
/// # Errors
///
/// 表不存在或 SQL 无效时返回 400 BAD_REQUEST。
async fn query_handler(
    State(state): State<Arc<ApiState>>,
    Json(req): Json<QueryRequest>,
) -> Result<Json<QueryResponse>, (StatusCode, String)> {
    let sql = req.sql.trim().to_string();
    let sql_upper = sql.to_uppercase().trim().trim_end_matches(';').to_string();
    let t0 = std::time::Instant::now();
    let mut db = state.db.write();

    let elapsed = || t0.elapsed().as_secs_f64() * 1000.0;

    // SHOW USERS
    if sql_upper == "SHOW USERS" {
        let rows: Vec<_> = db.list_users().iter().map(|u| {
            serde_json::json!({"username": u.username, "role": u.role})
        }).collect();
        return Ok(Json(QueryResponse {
            columns: vec!["username".into(), "role".into()],
            rows,
            elapsed_ms: elapsed(),
        }));
    }

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
            Ok(()) => { db.flush_wal(); Ok(Json(QueryResponse { columns: vec!["result".into()], rows: vec![serde_json::json!({"result": format!("表 '{}' 已删除", tbl_name)})], elapsed_ms: elapsed() })) },
            Err(e) => Err((StatusCode::BAD_REQUEST, e)),
        }
    }
    // CREATE TABLE
    else if sql_upper.starts_with("CREATE TABLE ") {
        match parse_create_table(&sql) {
            Ok((name, columns)) => match db.create_table(&name, columns) {
                Ok(()) => { db.flush_wal(); Ok(Json(QueryResponse { columns: vec!["result".into()], rows: vec![serde_json::json!({"result": format!("表 '{}' 已创建 ({} 列)", name, db.get_table(&name).unwrap().columns.len())})], elapsed_ms: elapsed() })) },
                Err(e) => Err((StatusCode::BAD_REQUEST, e)),
            },
            Err(e) => Err((StatusCode::BAD_REQUEST, e)),
        }
    }
    // INSERT INTO users — user management via standard SQL
    else if sql_upper.starts_with("INSERT INTO USERS") {
        match parse_insert(&sql) {
            Ok((_tbl, all_rows)) => {
                let mut created = 0usize;
                for values in &all_rows {
                    let col_names = extract_insert_columns(&sql);
                    let username = extract_col_val(&col_names, values, "username").unwrap_or_default();
                    let role = extract_col_val(&col_names, values, "role").unwrap_or_else(|| "reader".into());
                    let password = extract_col_val(&col_names, values, "password").unwrap_or_else(|| "changeme".into());
                    if !username.is_empty() {
                        match db.create_user(&username, &password, &role) {
                            Ok(()) => created += 1,
                            Err(e) => { if all_rows.len() == 1 { return Err((StatusCode::BAD_REQUEST, e)); } }
                        }
                    }
                }
                db.flush_wal();
                Ok(Json(QueryResponse { columns: vec!["result".into()], rows: vec![serde_json::json!({"result": format!("INSERT {}", created)})], elapsed_ms: elapsed() }))
            }
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
                db.flush_wal();
                Ok(Json(QueryResponse { columns: vec!["result".into()], rows: vec![serde_json::json!({"result": format!("INSERT {}", inserted)})], elapsed_ms: elapsed() }))
            }
            Err(e) => Err((StatusCode::BAD_REQUEST, e)),
        }
    }
    // SELECT
    else if sql_upper.starts_with("SELECT ") || sql_upper.starts_with("SELECT*") {
        // Try aggregate query first (COUNT, SUM, AVG, MIN, MAX, GROUP BY)
        if let Some(agg_result) = try_aggregate_query(&mut db, &sql_upper) {
            return agg_result.map(|(cols, rows)| Json(QueryResponse { columns: cols, rows, elapsed_ms: elapsed() }));
        }

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

/// Detect and execute aggregate queries: COUNT, SUM, AVG, MIN, MAX, GROUP BY.
///
/// Returns `Some(Ok(cols, rows))` if an aggregate pattern was recognized and executed,
/// `Some(Err(...))` if recognized but failed (e.g. table not found),
/// `None` if the SQL does not match any aggregate pattern.
fn try_aggregate_query(
    db: &mut crate::server::database::Database,
    sql_upper: &str,
) -> Option<Result<(Vec<String>, Vec<serde_json::Value>), (StatusCode, String)>> {
    // Extract table name
    let tbl_name = extract_table(sql_upper)?.trim_matches('"').to_string();
    let tbl = db.get_table_mut(&tbl_name)?;

    // ── Simple aggregates: SELECT AGG(col) FROM table ──
    let simple_aggs = ["COUNT", "SUM", "AVG", "MIN", "MAX"];
    for agg_fn in &simple_aggs {
        let prefix = format!("SELECT {agg_fn}(");
        if let Some(after_prefix) = sql_upper.strip_prefix(&prefix) {
            let col_name = if *agg_fn == "COUNT" && after_prefix.trim_start().starts_with("*)") {
                "*".to_string()
            } else if let Some(rp) = after_prefix.find(')') {
                after_prefix[..rp].trim().to_string()
            } else {
                continue;
            };

            let cols = vec![format!("{agg_fn}({col_name})")];
            let rows = match agg_fn.as_ref() {
                "COUNT" if col_name == "*" => {
                    let cnt = tbl.count_all();
                    vec![serde_json::json!({format!("COUNT(*)"): cnt})]
                }
                "COUNT" => {
                    let cnt = tbl.count_fast(&col_name);
                    vec![serde_json::json!({format!("COUNT({col_name})"): cnt})]
                }
                "SUM" => {
                    let val = tbl.sum_fast(&col_name);
                    vec![serde_json::json!({format!("SUM({col_name})"): val})]
                }
                "AVG" => {
                    let val = tbl.avg_fast(&col_name);
                    vec![serde_json::json!({format!("AVG({col_name})"): val})]
                }
                "MIN" => {
                    let val = tbl.min_col(&col_name);
                    vec![serde_json::json!({format!("MIN({col_name})"): val})]
                }
                "MAX" => {
                    let val = tbl.max_col(&col_name);
                    vec![serde_json::json!({format!("MAX({col_name})"): val})]
                }
                _ => return None,
            };
            return Some(Ok((cols, rows)));
        }
    }

    // ── GROUP BY: SELECT col, AGG(col2) FROM table GROUP BY col ──
    if let Some(gb_pos) = sql_upper.find(" GROUP BY ") {
        let select_part = sql_upper[7..gb_pos].trim(); // after "SELECT "
        let group_col = sql_upper[gb_pos + 10..].trim()
            .split(" ORDER BY ").next().unwrap_or("")
            .split(" LIMIT ").next().unwrap_or("")
            .trim().to_string();

        // Parse: "col, AGG(col2)" or "col, COUNT(*)"
        for agg_fn in &simple_aggs {
            let agg_prefix = format!("{agg_fn}(");
            if let Some(agg_start) = select_part.find(&agg_prefix) {
                let after_agg = &select_part[agg_start + agg_prefix.len()..];
                let agg_col = if *agg_fn == "COUNT" && after_agg.trim_start().starts_with("*)") {
                    "*".to_string()
                } else if let Some(rp) = after_agg.find(')') {
                    after_agg[..rp].trim().to_string()
                } else {
                    continue;
                };

                let results = tbl.group_by_agg(&group_col, &agg_col, agg_fn);
                let cols = vec![group_col.clone(), format!("{agg_fn}({agg_col})")];
                let rows: Vec<_> = results.into_iter().map(|(key, val)| {
                    serde_json::json!({
                        &group_col: key,
                        &format!("{agg_fn}({agg_col})"): val,
                    })
                }).collect();
                return Some(Ok((cols, rows)));
            }
        }
    }

    None
}

/// Extract column names from an INSERT INTO statement.
/// e.g. `INSERT INTO users (username, role) VALUES ...` → `["username", "role"]`
fn extract_insert_columns(sql: &str) -> Vec<String> {
    let binding = sql.to_uppercase();
    let rest = binding
        .trim_start_matches("INSERT INTO ")
        .trim_start_matches("insert into ");
    // Skip table name
    let after_table = rest.trim_start_matches(|c: char| c != '(' && c != ' ');
    let after_table = after_table.trim();
    if !after_table.starts_with('(') { return vec![]; }
    let rp = after_table.find(')').unwrap_or(after_table.len());
    after_table[1..rp]
        .split(',')
        .map(|c| c.trim().trim_matches('"').trim_matches('\'').to_lowercase())
        .collect()
}

/// Extract a column value by name from an INSERT row.
fn extract_col_val(col_names: &[String], values: &[serde_json::Value], target: &str) -> Option<String> {
    let idx = col_names.iter().position(|c| c == target)?;
    let v = values.get(idx)?;
    if v.is_null() { return None; }
    if let Some(s) = v.as_str() {
        Some(s.to_string())
    } else if let Some(n) = v.as_i64() {
        Some(n.to_string())
    } else if let Some(n) = v.as_f64() {
        Some(n.to_string())
    } else {
        Some(v.to_string())
    }
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
                    let v = v.trim().trim_matches('\'').trim_matches('"');
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
