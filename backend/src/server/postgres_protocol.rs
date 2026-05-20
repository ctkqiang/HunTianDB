//! PostgreSQL Wire Protocol v3.0 实现
//!
//! 支持标准 Start-up → Authentication → Query 流程。
//! 已接入内存数据库引擎：INSERT/SELECT/CREATE TABLE 真实执行。

use std::collections::HashMap;

use crate::error::{HunTianError, HunTianResult};
use crate::server::database::SharedDb;
use bytes::{Buf, BytesMut};
use serde_json::Value;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

#[derive(Debug)]
pub struct StartupMessage {
    pub protocol_version: i32,
    pub parameters: Vec<(String, String)>,
}
#[derive(Debug)]
pub struct QueryMessage {
    pub query_string: String,
}

pub struct PostgresProtocol {
    stream: TcpStream,
    buffer: BytesMut,
    authenticated: bool,
    username: Option<String>,
    database: Option<String>,
    prepared_sql: Option<String>,
    db: SharedDb,
}

impl PostgresProtocol {
    pub fn new(stream: TcpStream, db: SharedDb) -> Self {
        let _ = stream.set_nodelay(true);
        Self {
            stream,
            buffer: BytesMut::with_capacity(4096),
            authenticated: false,
            username: None,
            database: None,
            prepared_sql: None,
            db,
        }
    }

    pub async fn handle_connection(&mut self) -> HunTianResult<()> {
        self.handle_ssl_request().await?;
        let startup = self.read_startup_message().await?;
        self.username = startup
            .parameters
            .iter()
            .find(|(k, _)| k == "user")
            .map(|(_, v)| v.clone());
        self.database = startup
            .parameters
            .iter()
            .find(|(k, _)| k == "database")
            .map(|(_, v)| v.clone());

        // 认证: 请求明文密码并验证
        let user_opt = self.username.clone();
        if let Some(ref user) = user_opt {
            self.send_auth_cleartext_password().await?;
            let password = self.read_password_message().await?;
            let valid = { self.db.read().verify_password(user, &password) };
            if !valid {
                self.send_error("密码错误或用户不存在").await?;
                return Ok(());
            }
        }
        // AuthenticationOk — PG协议要求认证成功后必须发送
        self.stream.write_all(&[b'R', 0, 0, 0, 8, 0, 0, 0, 0]).await?;
        self.send_parameter_status("server_version", "9.6.0-HunTianDB")
            .await?;
        self.send_parameter_status("server_encoding", "UTF8")
            .await?;
        self.send_parameter_status("client_encoding", "UTF8")
            .await?;
        self.send_parameter_status("DateStyle", "ISO, MDY").await?;
        self.send_backend_key_data().await?;
        self.send_ready_for_query().await?;
        self.authenticated = true;

        loop {
            match self.read_message().await {
                Ok(msg_type) => match msg_type {
                    b'Q' => {
                        let q = self.read_simple_query().await?;
                        self.handle_query(&q.query_string).await?;
                    }
                    b'X' => break,
                    b'P' => {
                        let s = self.read_parse().await?;
                        self.send_parse_complete().await?;
                        self.prepared_sql = Some(s);
                    }
                    b'B' => {
                        self.skip_message().await?;
                        self.send_bind_complete().await?;
                    }
                    b'D' => {
                        let s = self.prepared_sql.clone();
                        self.skip_message().await?;
                        if let Some(ref sql) = s {
                            self.respond_describe(sql).await?;
                        }
                    }
                    b'E' => {
                        let s = self.prepared_sql.clone();
                        self.skip_message().await?;
                        if let Some(ref sql) = s {
                            self.handle_query_extended(sql).await?;
                        }
                    }
                    b'S' => {
                        self.skip_message().await?;
                        self.send_ready_for_query().await?;
                    }
                    _ => {
                        self.skip_message().await?;
                    }
                },
                Err(_) => break,
            }
        }
        Ok(())
    }

    // ---- handlers ----

    /// 扩展协议 Execute 阶段: Describe 已发送 RowDescription，此处跳过只发数据行。
    async fn handle_query_extended(&mut self, sql: &str) -> HunTianResult<()> {
        self.handle_query_inner(sql, true).await
    }

    async fn handle_query(&mut self, sql: &str) -> HunTianResult<()> {
        self.handle_query_inner(sql, false).await
    }

    async fn handle_query_inner(&mut self, sql: &str, skip_desc: bool) -> HunTianResult<()> {
        let s = sql.trim();
        let su = s.to_uppercase();
        tracing::info!("混天::查询 {}", s);

        if su.starts_with("SET ")
            || su.starts_with("RESET ")
            || su.starts_with("BEGIN")
            || su.starts_with("START ")
            || su.starts_with("COMMIT")
            || su.starts_with("ROLLBACK")
            || su.starts_with("DISCARD ")
            || su.starts_with("DEALLOCATE ")
        {
            self.send_command_complete("OK", 0).await?;
        } else if let Some(result) = try_handle_system_query(&su, s) {
            // 系统目录查询——返回 PostgreSQL 兼容的模拟响应
            if skip_desc {
                // 扩展协议: 只发数据行
                self.send_system_rows(&result).await?;
                self.send_command_complete("SELECT", result.rows.len() as u32).await?;
            } else {
                self.respond_system_query(result).await?;
            }
        } else if su.starts_with("SHOW TABLES") || su.contains("SHOW TABLES") {
            let names = { self.db.read().table_names() };
            self.send_row_desc("table_name").await?;
            for n in &names {
                self.send_data_row(n).await?;
            }
            self.send_command_complete("SELECT", names.len() as u32)
                .await?;
        } else if su.starts_with("DESCRIBE ")
            || su.starts_with("DESC ")
            || su.starts_with("SHOW COLUMNS ")
        {
            let tbl = su
                .trim_start_matches("DESCRIBE ")
                .trim_start_matches("DESC ")
                .trim_start_matches("SHOW COLUMNS FROM ")
                .trim()
                .trim_end_matches(';');
            let cols_info = {
                let db = self.db.read();
                db.get_table(tbl).map(|t| {
                    t.columns
                        .iter()
                        .map(|c| format!("{} ({})", c.name, c.col_type))
                        .collect::<Vec<_>>()
                })
            };
            if let Some(cols) = cols_info {
                self.send_row_desc("column_name").await?;
                for c in &cols {
                    self.send_data_row(c).await?;
                }
                self.send_command_complete("SELECT", cols.len() as u32)
                    .await?;
            } else {
                self.send_error(&format!("表 '{}' 不存在", tbl)).await?;
            }
        } else if su.starts_with("CREATE TABLE ") {
            let rest = s
                .trim_start_matches("CREATE TABLE ")
                .trim_start_matches("create table ")
                .trim();
            let lp = rest.find('(').unwrap_or(0);
            let name = rest[..lp].trim().trim_matches('"').to_string();
            let cols = self.parse_columns(&rest[lp..]);
            let result = { self.db.write().create_table(&name, cols) };
            match result {
                Ok(()) => { self.db.write().flush_wal(); self.send_command_complete("CREATE", 0).await? },
                Err(e) => self.send_error(&e).await?,
            }
        } else if su.starts_with("DROP TABLE ") {
            let name = su
                .trim_start_matches("DROP TABLE ")
                .trim()
                .trim_matches('"')
                .trim_end_matches(';');
            let result = { self.db.write().drop_table(name) };
            match result {
                Ok(()) => { self.db.write().flush_wal(); self.send_command_complete("DROP", 0).await? },
                Err(e) => self.send_error(&e).await?,
            }
        } else if su.starts_with("INSERT INTO ") {
            let all_vals = self.parse_insert_values(s);
            let tbl_name = self.extract_insert_table(s);
            let mut inserted = 0usize;
            for vals in &all_vals {
                let result = { self.db.write().log_insert(&tbl_name, vals.clone()) };
                match result {
                    Ok(()) => inserted += 1,
                    Err(_) => {}
                }
            }
            if inserted > 0 {
                { self.db.write().flush_wal(); }
                self.send_command_complete("INSERT", inserted as u32)
                    .await?;
            } else {
                self.send_error(&format!("表 '{}' 不存在或插入失败", tbl_name))
                    .await?;
            }
        } else if su.starts_with("SELECT") || su.starts_with("SELECT*") {
            // Try aggregate query first (COUNT, SUM, AVG, MIN, MAX, GROUP BY)
            let agg_result = pg_aggregate_query(&self.db, s);
            if let Some(agg_ok) = agg_result {
                match agg_ok {
                    Ok((cols, rows)) => {
                        if cols.is_empty() {
                            self.send_empty_result().await?;
                        } else {
                            self.send_multi_row_desc(&cols).await?;
                            for row in &rows {
                                let row_map: std::collections::HashMap<String, serde_json::Value> = row
                                    .as_object()
                                    .map(|m| m.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
                                    .unwrap_or_default();
                                self.send_multi_data_row(&cols, &row_map).await?;
                            }
                        }
                        self.send_command_complete("SELECT", rows.len() as u32).await?;
                    }
                    Err(msg) => {
                        self.send_error(&msg).await?;
                    }
                }
            } else {
            let tbl = self.extract_table_name(s);
            let limit = self.extract_limit(s).unwrap_or(100).min(1000);
            let desc = su.contains("DESC");
            let query_result = {
                let db = self.db.read();
                db.get_table(&tbl).map(|t| {
                    (
                        t.columns.iter().map(|c| c.name.clone()).collect::<Vec<_>>(),
                        t.select(limit, desc),
                    )
                })
            };
            if let Some((names, rows)) = query_result {
                if names.is_empty() {
                    self.send_empty_result().await?;
                } else {
                    self.send_multi_row_desc(&names).await?;
                    for row in &rows {
                        self.send_multi_data_row(&names, row).await?;
                    }
                }
                self.send_command_complete("SELECT", rows.len() as u32)
                    .await?;
            } else if su.contains("VERSION()") {
                self.send_row_desc("version").await?;
                self.send_data_row("PostgreSQL 9.6.0 HunTianDB v1.0")
                    .await?;
                self.send_command_complete("SELECT", 1).await?;
            } else if su.contains("CURRENT_DATABASE") {
                self.send_row_desc("current_database").await?;
                self.send_data_row("huntiandb").await?;
                self.send_command_complete("SELECT", 1).await?;
            } else if su.contains("PG_DATABASE") {
                self.send_row_desc("datname").await?;
                self.send_data_row("huntiandb").await?;
                self.send_command_complete("SELECT", 1).await?;
            } else if su.contains("PG_CLASS") && su.contains("RELKIND") {
                // DBeaver / pgAdmin table list query — return actual tables with metadata
                let names = { self.db.read().table_names() };
                let cols = vec!["Schema".to_string(), "Name".to_string(), "Type".to_string(), "Owner".to_string()];
                self.send_multi_row_desc(&cols).await?;
                for n in &names {
                    let mut row = HashMap::new();
                    row.insert("Schema".to_string(), Value::String("public".into()));
                    row.insert("Name".to_string(), Value::String(n.clone()));
                    row.insert("Type".to_string(), Value::String("table".into()));
                    row.insert("Owner".to_string(), Value::String("admin".into()));
                    self.send_multi_data_row(&cols, &row).await?;
                }
                self.send_command_complete("SELECT", names.len() as u32).await?;
            } else if su.contains("PG_CLASS") {
                // psql \dt — return actual tables (simple format)
                let names = { self.db.read().table_names() };
                self.send_row_desc("relname").await?;
                for n in &names {
                    self.send_data_row(n).await?;
                }
                self.send_command_complete("SELECT", names.len() as u32)
                    .await?;
            } else if su.contains("PG_NAMESPACE") {
                self.send_row_desc("nspname").await?;
                self.send_data_row("public").await?;
                self.send_command_complete("SELECT", 1).await?;
            } else if su.contains("PG_") || su.contains("INFORMATION_SCHEMA") {
                self.send_empty_result().await?;
                self.send_command_complete("SELECT", 0).await?;
            } else {
                self.send_error(&format!("表 '{}' 不存在", tbl)).await?;
            }
            } // close else block from aggregate check
        } else if su.starts_with("CREATE USER ") || su.starts_with("CREATE ROLE ") {
            let rest = s
                .trim_start_matches("CREATE USER ")
                .trim_start_matches("CREATE ROLE ")
                .trim_start_matches("create user ")
                .trim_start_matches("create role ")
                .trim();
            let name = rest
                .split_whitespace()
                .next()
                .unwrap_or("")
                .trim_matches('"');
            let pass = self
                .extract_quoted(rest, "PASSWORD")
                .unwrap_or_else(|| "changeme".into());
            let role = self
                .extract_quoted(rest, "ROLE")
                .unwrap_or_else(|| "writer".into());
            let result = { self.db.write().create_user(name, &pass, &role) };
            match result {
                Ok(()) => self.send_command_complete("CREATE USER", 1).await?,
                Err(e) => self.send_error(&e).await?,
            }
        } else if su.starts_with("DROP USER ") || su.starts_with("DROP ROLE ") {
            let name = su
                .trim_start_matches("DROP USER ")
                .trim_start_matches("DROP ROLE ")
                .trim()
                .trim_end_matches(';')
                .trim_matches('"');
            let result = { self.db.write().drop_user(name) };
            match result {
                Ok(()) => self.send_command_complete("DROP USER", 1).await?,
                Err(e) => self.send_error(&e).await?,
            }
        } else if su.starts_with("SHOW USERS") || su.starts_with("LIST USERS") || su == "\\DU" {
            let usernames = {
                self.db
                    .read()
                    .list_users()
                    .iter()
                    .map(|u| format!("{} ({})", u.username, u.role))
                    .collect::<Vec<_>>()
            };
            self.send_row_desc("username").await?;
            for u in &usernames {
                self.send_data_row(u).await?;
            }
            self.send_command_complete("SELECT", usernames.len() as u32)
                .await?;
        } else {
            self.send_error(&format!("不支持: {}", s)).await?;
        }
        self.send_ready_for_query().await?;
        Ok(())
    }

    fn extract_table_name(&self, sql: &str) -> String {
        let su = sql.to_uppercase();
        // 找到 FROM 后第一个非关键字词作为表名
        if let Some(idx) = su.find("FROM ") {
            let after = &su[idx + 5..].trim();
            after
                .split_whitespace()
                .next()
                .unwrap_or("events")
                .trim_matches('"')
                .trim_end_matches(';')
                .trim_end_matches(')')
                .to_lowercase()
        } else {
            "events".into()
        }
    }

    fn extract_limit(&self, sql: &str) -> Option<usize> {
        let idx = sql.to_uppercase().rfind("LIMIT ")?;
        sql[idx + 6..]
            .trim()
            .split_whitespace()
            .next()?
            .trim_end_matches(';')
            .parse()
            .ok()
    }

    fn extract_insert_table(&self, sql: &str) -> String {
        let s = sql
            .trim()
            .trim_start_matches("INSERT INTO ")
            .trim_start_matches("insert into ")
            .trim();
        s.split(|c: char| c == ' ' || c == '(')
            .next()
            .unwrap_or("events")
            .trim_matches('"')
            .to_lowercase()
    }

    fn parse_insert_values(&self, sql: &str) -> Vec<Vec<serde_json::Value>> {
        let mut all_rows = Vec::new();
        if let Some(lp) = sql.find("VALUES") {
            let val_str = &sql[lp + 6..].trim();
            let bytes = val_str.as_bytes();
            let mut depth = 0i32;
            let mut row_start = 0usize;
            for (i, &b) in bytes.iter().enumerate() {
                if b == b'(' {
                    depth += 1;
                    if depth == 1 {
                        row_start = i + 1;
                    }
                } else if b == b')' {
                    depth -= 1;
                    if depth == 0 {
                        if let Ok(row_str) = std::str::from_utf8(&bytes[row_start..i]) {
                            let vals: Vec<serde_json::Value> = row_str
                                .split(',')
                                .map(|v| {
                                    let v = v.trim().trim_matches('\'').trim_matches('"');
                                    if v.eq_ignore_ascii_case("NULL") || v.is_empty() {
                                        serde_json::Value::Null
                                    } else if let Ok(n) = v.parse::<i64>() {
                                        serde_json::json!(n)
                                    } else {
                                        serde_json::json!(v)
                                    }
                                })
                                .collect();
                            if !vals.is_empty() {
                                all_rows.push(vals);
                            }
                        }
                    }
                }
            }
        }
        all_rows
    }

    fn extract_quoted(&self, sql: &str, keyword: &str) -> Option<String> {
        let su = sql.to_uppercase();
        let idx = su.find(&format!(" {} ", keyword.to_uppercase()))?;
        let after = &sql[idx + keyword.len() + 2..].trim();
        if after.starts_with('\'') {
            let end = after[1..].find('\'')?;
            Some(after[1..end + 1].to_string())
        } else {
            after
                .split_whitespace()
                .next()
                .map(|s| s.trim_matches('\'').to_string())
        }
    }

    fn parse_columns(&self, s: &str) -> Vec<crate::server::database::ColumnDef> {
        let inner = s.trim_matches(|c: char| c == '(' || c == ')' || c == ';');
        inner
            .split(',')
            .filter_map(|c| {
                let parts: Vec<&str> = c.trim().split_whitespace().collect();
                if parts.len() >= 2 {
                    Some(crate::server::database::ColumnDef {
                        name: parts[0].to_string(),
                        col_type: parts[1].to_uppercase(),
                        nullable: !c.to_uppercase().contains("NOT NULL"),
                    })
                } else {
                    None
                }
            })
            .collect()
    }

    async fn respond_describe(&mut self, sql: &str) -> HunTianResult<()> {
        let su = sql.to_uppercase();

        // DDL/DML/SET — 无结果行，发送 NoData
        if su.starts_with("SET ") || su.starts_with("RESET ") || su.starts_with("BEGIN")
            || su.starts_with("COMMIT") || su.starts_with("ROLLBACK")
            || su.starts_with("INSERT ") || su.starts_with("CREATE ")
            || su.starts_with("DROP ") || su.starts_with("DELETE ")
            || su.starts_with("DEALLOCATE ") || su.starts_with("DISCARD ")
        {
            self.send_no_data().await?;
            return Ok(());
        }

        // 系统目录查询 — 返回正确的列元数据
        if let Some(sys_result) = try_handle_system_query(&su, sql) {
            if sys_result.columns.is_empty() {
                self.send_no_data().await?;
            } else {
                let col_names: Vec<String> = sys_result.columns.iter().map(|(n, _)| n.clone()).collect();
                self.send_multi_row_desc(&col_names).await?;
            }
            return Ok(());
        }

        let tbl = self.extract_table_name(sql);
        let cols: Option<Vec<String>> = {
            let db = self.db.read();
            db.get_table(&tbl).map(|t| t.columns.iter().map(|c| c.name.clone()).collect())
        };
        if let Some(cols) = cols {
            self.send_multi_row_desc(&cols).await?;
        } else if su.contains("VERSION") || su.contains("CURRENT_") || su.contains("PG_") {
            self.send_row_desc("result").await?;
        } else {
            self.send_empty_result().await?;
        }
        Ok(())
    }

    async fn handle_ssl_request(&mut self) -> HunTianResult<()> {
        self.read_exact(4).await?;
        let len = self.buffer.get_i32();
        if len == 8 {
            self.read_exact(4).await?;
            let _ = self.buffer.get_i32();
            self.stream.write_all(&[b'N']).await?;
            self.stream.flush().await?;
        } else {
            let s = len.to_be_bytes().to_vec();
            self.buffer = BytesMut::with_capacity(4096);
            self.buffer.extend_from_slice(&s);
        }
        Ok(())
    }

    async fn read_startup_message(&mut self) -> HunTianResult<StartupMessage> {
        self.read_exact(4).await?;
        let len = self.buffer.get_i32();
        let pl = (len - 4) as usize;
        self.read_exact(pl).await?;
        let proto = self.buffer.get_i32();
        let mut p = vec![];
        while self.buffer.has_remaining() {
            let k = self.read_cstr();
            if k.is_empty() {
                break;
            }
            let v = self.read_cstr();
            p.push((k, v));
        }
        Ok(StartupMessage {
            protocol_version: proto,
            parameters: p,
        })
    }

    async fn read_simple_query(&mut self) -> HunTianResult<QueryMessage> {
        self.read_exact(4).await?;
        let len = self.buffer.get_i32();
        let pl = (len - 4) as usize;
        self.read_exact(pl).await?;
        let q = self.read_cstr();
        self.buffer.clear();
        Ok(QueryMessage { query_string: q })
    }

    async fn read_parse(&mut self) -> HunTianResult<String> {
        self.read_exact(4).await?;
        let len = self.buffer.get_i32();
        let pl = (len - 4) as usize;
        self.read_exact(pl).await?;
        let _ = self.read_cstr();
        let sql = self.read_cstr();
        self.buffer.clear();
        Ok(sql)
    }

    async fn send_auth_cleartext_password(&mut self) -> HunTianResult<()> {
        // AuthenticationCleartextPassword: type 'R', length 8, auth type 3
        self.stream
            .write_all(&[b'R', 0, 0, 0, 8, 0, 0, 0, 3])
            .await?;
        Ok(())
    }

    async fn read_password_message(&mut self) -> HunTianResult<String> {
        loop {
            self.read_exact(1).await?;
            let msg_type = self.buffer.get_u8();
            if msg_type == b'p' {
                self.read_exact(4).await?;
                let len = self.buffer.get_i32();
                let payload = (len - 4) as usize;
                self.read_exact(payload).await?;
                let password = self.read_cstr();
                self.buffer.clear();
                return Ok(password);
            }
        }
    }
    async fn send_ready_for_query(&mut self) -> HunTianResult<()> {
        self.stream.write_all(&[b'Z', 0, 0, 0, 5, b'I']).await?;
        Ok(())
    }
    async fn send_parse_complete(&mut self) -> HunTianResult<()> {
        self.stream.write_all(&[b'1', 0, 0, 0, 4]).await?;
        self.stream.flush().await?;
        Ok(())
    }
    async fn send_bind_complete(&mut self) -> HunTianResult<()> {
        self.stream.write_all(&[b'2', 0, 0, 0, 4]).await?;
        self.stream.flush().await?;
        Ok(())
    }

    async fn send_parameter_status(&mut self, name: &str, value: &str) -> HunTianResult<()> {
        let nb = name.as_bytes();
        let vb = value.as_bytes();
        let len = 4 + nb.len() + 1 + vb.len() + 1;
        let mut m = Vec::with_capacity(1 + len);
        m.push(b'S');
        m.extend_from_slice(&(len as i32).to_be_bytes());
        m.extend_from_slice(nb);
        m.push(0);
        m.extend_from_slice(vb);
        m.push(0);
        self.stream.write_all(&m).await?;
        Ok(())
    }

    async fn send_backend_key_data(&mut self) -> HunTianResult<()> {
        self.stream
            .write_all(&[b'K', 0, 0, 0, 12, 0, 0, 0, 1, 0, 0, 0, 0])
            .await?;
        Ok(())
    }

    async fn send_command_complete(&mut self, tag: &str, rows: u32) -> HunTianResult<()> {
        let ts = if tag == "INSERT" {
            format!("INSERT 0 {}", rows)
        } else {
            format!("{} {}", tag, rows)
        };
        let len = 4 + ts.len() + 1;
        let mut m = Vec::with_capacity(1 + len);
        m.push(b'C');
        m.extend_from_slice(&(len as i32).to_be_bytes());
        m.extend_from_slice(ts.as_bytes());
        m.push(0);
        self.stream.write_all(&m).await?;
        Ok(())
    }

    async fn send_error(&mut self, msg: &str) -> HunTianResult<()> {
        let mut p = vec![b'S'];
        p.extend_from_slice(b"ERROR");
        p.push(0);
        p.push(b'M');
        p.extend_from_slice(msg.as_bytes());
        p.push(0);
        p.push(0);
        let len = 4 + p.len();
        let mut m = Vec::with_capacity(1 + len);
        m.push(b'E');
        m.extend_from_slice(&(len as i32).to_be_bytes());
        m.extend_from_slice(&p);
        self.stream.write_all(&m).await?;
        Ok(())
    }

    async fn send_row_desc(&mut self, col_name: &str) -> HunTianResult<()> {
        let n = col_name.as_bytes();
        let len: i32 = 4 + 2 + (n.len() as i32) + 1 + 4 + 2 + 4 + 2 + 4 + 2;
        let mut m = Vec::with_capacity(1 + len as usize);
        m.push(b'T');
        m.extend_from_slice(&len.to_be_bytes());
        m.extend_from_slice(&1i16.to_be_bytes());
        m.extend_from_slice(n);
        m.push(0);
        m.extend_from_slice(&0i32.to_be_bytes());
        m.extend_from_slice(&1i16.to_be_bytes());
        m.extend_from_slice(&25i32.to_be_bytes());
        m.extend_from_slice(&(-1i16).to_be_bytes());
        m.extend_from_slice(&(-1i32).to_be_bytes());
        m.extend_from_slice(&0i16.to_be_bytes());
        self.stream.write_all(&m).await?;
        Ok(())
    }

    async fn send_multi_row_desc(&mut self, cols: &[String]) -> HunTianResult<()> {
        let ncols = cols.len() as i16;
        let body_len: i32 = cols
            .iter()
            .map(|c| c.len() as i32 + 1 + 4 + 2 + 4 + 2 + 4 + 2)
            .sum();
        let len: i32 = 4 + 2 + body_len;
        let mut m = Vec::with_capacity(1 + len as usize);
        m.push(b'T');
        m.extend_from_slice(&len.to_be_bytes());
        m.extend_from_slice(&ncols.to_be_bytes());
        for i in 0..ncols {
            let n = cols[i as usize].as_bytes();
            m.extend_from_slice(n);
            m.push(0);
            m.extend_from_slice(&0i32.to_be_bytes());
            m.extend_from_slice(&(i + 1_i16).to_be_bytes());
            m.extend_from_slice(&25i32.to_be_bytes());
            m.extend_from_slice(&(-1i16).to_be_bytes());
            m.extend_from_slice(&(-1i32).to_be_bytes());
            m.extend_from_slice(&0i16.to_be_bytes());
        }
        self.stream.write_all(&m).await?;
        Ok(())
    }

    async fn send_data_row(&mut self, value: &str) -> HunTianResult<()> {
        let v = value.as_bytes();
        let len: i32 = 4 + 2 + 4 + (v.len() as i32);
        let mut m = Vec::with_capacity(1 + len as usize);
        m.push(b'D');
        m.extend_from_slice(&len.to_be_bytes());
        m.extend_from_slice(&1i16.to_be_bytes());
        m.extend_from_slice(&(v.len() as i32).to_be_bytes());
        m.extend_from_slice(v);
        self.stream.write_all(&m).await?;
        Ok(())
    }

    async fn send_multi_data_row(
        &mut self,
        cols: &[String],
        row: &std::collections::HashMap<String, serde_json::Value>,
    ) -> HunTianResult<()> {
        let ncols = cols.len() as i16;
        let vals: Vec<String> = cols
            .iter()
            .map(|c| {
                row.get(c)
                    .map(|v| match v {
                        serde_json::Value::Null => "NULL".into(),
                        serde_json::Value::String(s) => s.clone(),
                        serde_json::Value::Number(n) => n.to_string(),
                        other => other.to_string(),
                    })
                    .unwrap_or_else(|| "NULL".into())
            })
            .collect();
        let vals_len: i32 = vals.iter().map(|v| 4 + v.len() as i32).sum();
        let len: i32 = 4 + 2 + vals_len;
        let mut m = Vec::with_capacity(1 + len as usize);
        m.push(b'D');
        m.extend_from_slice(&len.to_be_bytes());
        m.extend_from_slice(&ncols.to_be_bytes());
        for v in &vals {
            m.extend_from_slice(&(v.len() as i32).to_be_bytes());
            m.extend_from_slice(v.as_bytes());
        }
        self.stream.write_all(&m).await?;
        Ok(())
    }

    /// 发送系统目录查询的完整响应（含 RowDescription + DataRow + CommandComplete）。
    async fn respond_system_query(&mut self, result: SystemQueryResult) -> HunTianResult<()> {
        if result.columns.is_empty() {
            self.send_empty_result().await?;
            self.send_command_complete("SELECT", 0).await?;
        } else {
            let col_names: Vec<String> = result.columns.iter().map(|(n, _)| n.clone()).collect();
            self.send_multi_row_desc(&col_names).await?;
            for row in &result.rows {
                let mut map = HashMap::new();
                for (i, val) in row.iter().enumerate() {
                    if let Some((col_name, _)) = result.columns.get(i) {
                        map.insert(col_name.clone(), Value::String(val.clone()));
                    }
                }
                self.send_multi_data_row(&col_names, &map).await?;
            }
            self.send_command_complete("SELECT", result.rows.len() as u32).await?;
        }
        Ok(())
    }

    /// 扩展协议专用：只发送数据行（RowDescription 已在 Describe 阶段发送）。
    async fn send_system_rows(&mut self, result: &SystemQueryResult) -> HunTianResult<()> {
        let col_names: Vec<String> = result.columns.iter().map(|(n, _)| n.clone()).collect();
        for row in &result.rows {
            let mut map = HashMap::new();
            for (i, val) in row.iter().enumerate() {
                if let Some((col_name, _)) = result.columns.get(i) {
                    map.insert(col_name.clone(), Value::String(val.clone()));
                }
            }
            self.send_multi_data_row(&col_names, &map).await?;
        }
        Ok(())
    }

    /// 发送 NoData 消息（PG 协议 'n' — 无结果列）。
    async fn send_no_data(&mut self) -> HunTianResult<()> {
        self.stream.write_all(b"n\0\0\0\x04").await?;
        Ok(())
    }

    async fn send_empty_result(&mut self) -> HunTianResult<()> {
        self.stream.write_all(&[b'T', 0, 0, 0, 6, 0, 0]).await?;
        Ok(())
    }

    async fn read_message(&mut self) -> HunTianResult<u8> {
        self.read_exact(1).await?;
        Ok(self.buffer.get_u8())
    }

    async fn skip_message(&mut self) -> HunTianResult<()> {
        self.read_exact(4).await?;
        let len = self.buffer.get_i32();
        if len > 4 {
            self.read_exact((len - 4) as usize).await?;
            self.buffer.clear();
        }
        Ok(())
    }

    async fn read_exact(&mut self, n: usize) -> HunTianResult<()> {
        let mut buf = vec![0u8; n];
        self.stream
            .read_exact(&mut buf)
            .await
            .map_err(|e| HunTianError::Protocol(format!("读取失败: {}", e)))?;
        self.buffer.extend_from_slice(&buf);
        Ok(())
    }

    fn read_cstr(&mut self) -> String {
        let mut b = vec![];
        while self.buffer.has_remaining() {
            let ch = self.buffer.get_u8();
            if ch == 0 {
                break;
            }
            b.push(ch);
        }
        String::from_utf8_lossy(&b).into_owned()
    }
}

/// Execute aggregate query against the database engine.
/// Returns Some(Ok(cols, rows)) on success, Some(Err(msg)) on failure, None if not an aggregate query.
fn pg_aggregate_query(
    db: &SharedDb,
    sql: &str,
) -> Option<Result<(Vec<String>, Vec<serde_json::Value>), String>> {
    let su = sql.to_uppercase();
    let mut db = db.write();

    let from_idx = su.find("FROM ")?;
    let after_from = su[from_idx + 5..].trim();
    let tbl_name = after_from
        .split_whitespace()
        .next()?
        .trim_matches('"')
        .to_string();
    let tbl = db.get_table_mut(&tbl_name)?;

    let agg_fns = ["COUNT", "SUM", "AVG", "MIN", "MAX"];
    for agg_fn in &agg_fns {
        let prefix = format!("SELECT {agg_fn}(");
        if let Some(after_prefix) = su.strip_prefix(&prefix) {
            let col_name = if *agg_fn == "COUNT" && after_prefix.trim_start().starts_with("*)") {
                "*".to_string()
            } else if let Some(rp) = after_prefix.find(')') {
                after_prefix[..rp].trim().to_string()
            } else {
                continue;
            };

            let agg_col_label = format!("{agg_fn}({col_name})");
            let row = match agg_fn.as_ref() {
                "COUNT" if col_name == "*" => {
                    serde_json::json!({&agg_col_label: tbl.count_all()})
                }
                "COUNT" => {
                    // Vectorized: use column cache for fast non-null count
                    let count = tbl.count_fast(&col_name);
                    serde_json::json!({&agg_col_label: count})
                }
                "SUM" => {
                    let sum = tbl.sum_fast(&col_name);
                    serde_json::json!({&agg_col_label: sum})
                }
                "AVG" => {
                    let avg = tbl.avg_fast(&col_name);
                    serde_json::json!({&agg_col_label: avg})
                }
                "MIN" => {
                    serde_json::json!({&agg_col_label: tbl.min_col(&col_name)})
                }
                "MAX" => {
                    serde_json::json!({&agg_col_label: tbl.max_col(&col_name)})
                }
                _ => return None,
            };
            return Some(Ok((vec![agg_col_label], vec![row])));
        }
    }

    // GROUP BY: SELECT col, AGG(col2) FROM table GROUP BY col
    if let Some(gb_pos) = su.find(" GROUP BY ") {
        let select_part = su[7..gb_pos].trim();
        let after_gb = su[gb_pos + 10..].trim();
        let group_col = after_gb
            .split(" ORDER BY ").next().unwrap_or("")
            .split(" LIMIT ").next().unwrap_or("")
            .trim().to_string();

        for agg_fn in &agg_fns {
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
                let rows: Vec<serde_json::Value> = results
                    .into_iter()
                    .map(|(key, val)| {
                        serde_json::json!({
                            &group_col: key,
                            &format!("{agg_fn}({agg_col})"): val,
                        })
                    })
                    .collect();
                return Some(Ok((cols, rows)));
            }
        }
    }

    None
}

// ── 系统目录查询拦截器 ──
// 为 DBeaver/pgAdmin 等 GUI 工具提供 PostgreSQL 兼容的模拟响应。

struct SystemQueryResult {
    columns: Vec<(String, String)>,
    rows: Vec<Vec<String>>,
}

/// 匹配常见系统目录查询，返回模拟结果。
fn try_handle_system_query(su: &str, _raw: &str) -> Option<SystemQueryResult> {
    // SHOW TABLES / USERS / COLUMNS / DESCRIBE — 交给常规处理器
    if su.starts_with("SHOW TABLES") || su.starts_with("SHOW USERS") || su.starts_with("SHOW COLUMNS")
        || su.starts_with("DESCRIBE ") || su.starts_with("DESC ") {
        return None;
    }

    // SELECT version()
    if su.starts_with("SELECT VERSION()") || su.contains("VERSION()") {
        return Some(SystemQueryResult {
            columns: vec![("version".into(), "text".into())],
            rows: vec![vec!["PostgreSQL 16.0 (HunTianDB)".into()]],
        });
    }

    // SELECT current_schema() / current_database() 及组合
    if su.starts_with("SELECT CURRENT_SCHEMA()") || su.contains("CURRENT_SCHEMA()") {
        let mut cols = vec![("current_schema".into(), "name".into())];
        let mut row = vec!["public".into()];
        if su.contains("SESSION_USER") { cols.push(("session_user".into(), "name".into())); row.push("admin".into()); }
        if su.contains("CURRENT_USER") { cols.push(("current_user".into(), "name".into())); row.push("admin".into()); }
        return Some(SystemQueryResult { columns: cols, rows: vec![row] });
    }
    if su.starts_with("SELECT CURRENT_DATABASE()") {
        return Some(SystemQueryResult {
            columns: vec![("current_database".into(), "name".into())],
            rows: vec![vec!["huntiandb".into()]],
        });
    }

    // SHOW xxx / current_setting
    if su.starts_with("SELECT CURRENT_SETTING(") || su.starts_with("SHOW ") {
        let value = if su.contains("CLIENT_ENCODING") { "UTF8" }
            else if su.contains("STANDARD_CONFORMING_STRINGS") { "on" }
            else if su.contains("SERVER_VERSION") { "16.0" }
            else if su.contains("TIMEZONE") { "UTC" }
            else if su.contains("DATESTYLE") { "ISO, MDY" }
            else if su.contains("MAX_IDENTIFIER_LENGTH") { "63" }
            else if su.contains("TRANSACTION_ISOLATION") { "read committed" }
            else if su.contains("APPLICATION_NAME") { "DBeaver" }
            else { "on" };
        return Some(SystemQueryResult {
            columns: vec![(value.to_string(), "text".into())],
            rows: vec![vec![value.into()]],
        });
    }

    // pg_catalog.pg_settings
    if su.contains("PG_SETTINGS") {
        return Some(SystemQueryResult {
            columns: vec![("name".into(),"text".into()),("setting".into(),"text".into()),
                ("unit".into(),"text".into()),("category".into(),"text".into()),
                ("short_desc".into(),"text".into()),("extra_desc".into(),"text".into()),
                ("context".into(),"text".into()),("vartype".into(),"text".into()),
                ("source".into(),"text".into()),("min_val".into(),"text".into()),
                ("max_val".into(),"text".into()),("enumvals".into(),"text".into()),
                ("boot_val".into(),"text".into()),("reset_val".into(),"text".into()),
                ("sourcefile".into(),"text".into()),("sourceline".into(),"text".into()),
                ("pending_restart".into(),"text".into())],
            rows: vec![
                vec!["client_encoding".into(),"UTF8".into(),String::new(),"Client Connection Defaults".into(),"Sets the client's character set encoding.".into(),String::new(),"user".into(),"string".into(),"session".into(),String::new(),String::new(),String::new(),"UTF8".into(),"UTF8".into(),String::new(),String::new(),"f".into()],
                vec!["server_version".into(),"16.0".into(),String::new(),"Reporting and Logging".into(),"Shows the server version.".into(),String::new(),"internal".into(),"string".into(),"default".into(),String::new(),String::new(),String::new(),"16.0".into(),"16.0".into(),String::new(),String::new(),"f".into()],
            ],
        });
    }

    // pg_catalog.pg_database
    if su.contains("PG_DATABASE") {
        return Some(SystemQueryResult {
            columns: vec![("datname".into(),"name".into()),("datdba".into(),"oid".into()),
                ("encoding".into(),"int4".into()),("datcollate".into(),"name".into()),
                ("datctype".into(),"name".into()),("datistemplate".into(),"bool".into()),
                ("datallowconn".into(),"bool".into()),("datconnlimit".into(),"int4".into()),
                ("datlastsysoid".into(),"oid".into()),("datfrozenxid".into(),"xid".into()),
                ("datminmxid".into(),"xid".into()),("dattablespace".into(),"oid".into()),
                ("datacl".into(),"text[]".into())],
            rows: vec![vec!["huntiandb".into(),"10".into(),"6".into(),"en_US.UTF-8".into(),"en_US.UTF-8".into(),"f".into(),"t".into(),"-1".into(),"0".into(),"0".into(),"0".into(),"1663".into(),String::new()]],
        });
    }

    // pg_catalog.pg_roles
    if su.contains("PG_ROLES") || su.contains("PG_USER") || su.contains("PG_AUTHID") {
        return Some(SystemQueryResult {
            columns: vec![("rolname".into(),"name".into()),("rolsuper".into(),"bool".into()),
                ("rolinherit".into(),"bool".into()),("rolcreaterole".into(),"bool".into()),
                ("rolcreatedb".into(),"bool".into()),("rolcanlogin".into(),"bool".into()),
                ("rolreplication".into(),"bool".into()),("rolconnlimit".into(),"int4".into()),
                ("rolpassword".into(),"text".into()),("rolvaliduntil".into(),"timestamptz".into())],
            rows: vec![vec!["admin".into(),"t".into(),"t".into(),"t".into(),"t".into(),"t".into(),"t".into(),"-1".into(),"********".into(),String::new()]],
        });
    }

    // pg_catalog.pg_type (含 JOIN)
    if su.contains("PG_TYPE") || su.contains("PG_GET_KEYWORDS") {
        if su.contains("PG_GET_KEYWORDS") {
            return Some(SystemQueryResult {
                columns: vec![("string_agg".into(), "text".into())],
                rows: vec![vec!["SELECT,FROM,WHERE,INSERT,UPDATE,DELETE,CREATE,DROP,TABLE,INTO,VALUES,SET,AND,OR,NOT,NULL,TRUE,FALSE,ORDER,BY,GROUP,LIMIT,OFFSET,JOIN,LEFT,RIGHT,INNER,ON,AS,DISTINCT,COUNT,SUM,AVG,MIN,MAX,LIKE,IN,BETWEEN,IS,DEFAULT,PRIMARY,KEY".into()]],
            });
        }
        return Some(SystemQueryResult {
            columns: vec![("oid".into(),"oid".into()),("typname".into(),"name".into()),
                ("typlen".into(),"int2".into()),("typbyval".into(),"bool".into()),
                ("typtype".into(),"char".into()),("typcategory".into(),"char".into())],
            rows: vec![
                vec!["23".into(),"int4".into(),"4".into(),"t".into(),"b".into(),"N".into()],
                vec!["20".into(),"int8".into(),"8".into(),"f".into(),"b".into(),"N".into()],
                vec!["25".into(),"text".into(),"-1".into(),"f".into(),"b".into(),"S".into()],
                vec!["1043".into(),"varchar".into(),"-1".into(),"f".into(),"b".into(),"S".into()],
                vec!["16".into(),"bool".into(),"1".into(),"t".into(),"b".into(),"C".into()],
                vec!["21".into(),"int2".into(),"2".into(),"t".into(),"b".into(),"N".into()],
                vec!["700".into(),"float4".into(),"4".into(),"t".into(),"b".into(),"N".into()],
                vec!["701".into(),"float8".into(),"8".into(),"t".into(),"b".into(),"N".into()],
            ],
        });
    }

    // 其他 pg_catalog — 空结果
    if su.contains("PG_CATALOG.") || su.contains("PG_ATTRIBUTE") || su.contains("PG_INDEX")
        || su.contains("PG_CONSTRAINT") || su.contains("PG_STATISTIC") || su.contains("PG_PROC")
        || su.contains("PG_DESCRIPTION") || su.contains("PG_TABLESPACE") || su.contains("PG_COLLATION")
        || su.contains("PG_AM") || su.contains("PG_OPCLASS") || su.contains("PG_EXTENSION")
    {
        return Some(SystemQueryResult { columns: vec![], rows: vec![] });
    }

    None
}
