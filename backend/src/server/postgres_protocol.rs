//! PostgreSQL Wire Protocol v3.0 实现
//!
//! 支持标准 Start-up → Authentication → Query 流程。
//! 已接入内存数据库引擎：INSERT/SELECT/CREATE TABLE 真实执行。

use bytes::{Buf, BufMut, BytesMut};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use std::sync::Arc;
use crate::error::{HunTianError, HunTianResult};
use crate::server::database::{Database, SharedDb};

#[derive(Debug)]
pub struct StartupMessage { pub protocol_version: i32, pub parameters: Vec<(String, String)> }
#[derive(Debug)]
pub struct QueryMessage { pub query_string: String }

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
        Self { stream, buffer: BytesMut::with_capacity(4096), authenticated: false, username: None, database: None, prepared_sql: None, db }
    }

    pub async fn handle_connection(&mut self) -> HunTianResult<()> {
        self.handle_ssl_request().await?;
        let startup = self.read_startup_message().await?;
        self.username = startup.parameters.iter().find(|(k,_)| k=="user").map(|(_,v)| v.clone());
        self.database = startup.parameters.iter().find(|(k,_)| k=="database").map(|(_,v)| v.clone());
        self.send_authentication_ok().await?;
        self.send_parameter_status("server_version", "9.6.0-HunTianDB").await?;
        self.send_parameter_status("server_encoding", "UTF8").await?;
        self.send_parameter_status("client_encoding", "UTF8").await?;
        self.send_parameter_status("DateStyle", "ISO, MDY").await?;
        self.send_backend_key_data().await?;
        self.send_ready_for_query().await?;
        self.authenticated = true;

        loop {
            match self.read_message().await {
                Ok(msg_type) => {
                    match msg_type {
                        b'Q' => { let q = self.read_simple_query().await?; self.handle_query(&q.query_string).await?; }
                        b'X' => break,
                        b'P' => { let s = self.read_parse().await?; self.send_parse_complete().await?; self.prepared_sql = Some(s); }
                        b'B' => { self.skip_message().await?; self.send_bind_complete().await?; }
                        b'D' => { let s = self.prepared_sql.clone(); self.skip_message().await?; if let Some(ref sql) = s { self.respond_describe(sql).await?; } }
                        b'E' => { let s = self.prepared_sql.clone(); self.skip_message().await?; if let Some(ref sql) = s { self.handle_query(sql).await?; } }
                        b'S' => { self.skip_message().await?; self.send_ready_for_query().await?; }
                        _ => { self.skip_message().await?; }
                    }
                }
                Err(_) => break,
            }
        }
        Ok(())
    }

    // ---- handlers ----

    async fn handle_query(&mut self, sql: &str) -> HunTianResult<()> {
        let s = sql.trim();
        let su = s.to_uppercase();
        tracing::info!("PG: {}", s);

        if su.starts_with("SET ") || su.starts_with("RESET ") || su.starts_with("BEGIN") || su.starts_with("START ") || su.starts_with("COMMIT") || su.starts_with("ROLLBACK") || su.starts_with("DISCARD ") || su.starts_with("DEALLOCATE ") {
            self.send_command_complete("OK", 0).await?;
        } else if su.starts_with("SHOW TABLES") || su.contains("SHOW TABLES") {
            let names = { self.db.read().table_names() };
            self.send_row_desc("table_name").await?;
            for n in &names { self.send_data_row(n).await?; }
            self.send_command_complete("SELECT", names.len() as u32).await?;
        } else if su.starts_with("DESCRIBE ") || su.starts_with("DESC ") || su.starts_with("SHOW COLUMNS ") {
            let tbl = su.trim_start_matches("DESCRIBE ").trim_start_matches("DESC ").trim_start_matches("SHOW COLUMNS FROM ").trim().trim_end_matches(';');
            let cols_info = {
                let db = self.db.read();
                db.get_table(tbl).map(|t| t.columns.iter().map(|c| format!("{} ({})", c.name, c.col_type)).collect::<Vec<_>>())
            };
            if let Some(cols) = cols_info {
                self.send_row_desc("column_name").await?;
                for c in &cols { self.send_data_row(c).await?; }
                self.send_command_complete("SELECT", cols.len() as u32).await?;
            } else {
                self.send_error(&format!("表 '{}' 不存在", tbl)).await?;
            }
        } else if su.starts_with("CREATE TABLE ") {
            let rest = s.trim_start_matches("CREATE TABLE ").trim_start_matches("create table ").trim();
            let lp = rest.find('(').unwrap_or(0);
            let name = rest[..lp].trim().trim_matches('"').to_string();
            let cols = self.parse_columns(&rest[lp..]);
            let result = { self.db.write().create_table(&name, cols) };
            match result {
                Ok(()) => self.send_command_complete("CREATE", 0).await?,
                Err(e) => self.send_error(&e).await?,
            }
        } else if su.starts_with("DROP TABLE ") {
            let name = su.trim_start_matches("DROP TABLE ").trim().trim_matches('"').trim_end_matches(';');
            let result = { self.db.write().drop_table(name) };
            match result {
                Ok(()) => self.send_command_complete("DROP", 0).await?,
                Err(e) => self.send_error(&e).await?,
            }
        } else if su.starts_with("INSERT INTO ") {
            let vals = self.parse_insert_values(s);
            let tbl_name = self.extract_insert_table(s);
            let result = { self.db.write().get_table_mut(&tbl_name).map(|t| t.insert(vals)) };
            match result {
                Some(Ok(())) => self.send_command_complete("INSERT", 1).await?,
                Some(Err(e)) => self.send_error(&e).await?,
                None => self.send_error(&format!("表 '{}' 不存在", tbl_name)).await?,
            }
        } else if su.starts_with("SELECT") || su.starts_with("SELECT*") {
            let tbl = self.extract_table_name(s);
            let limit = self.extract_limit(s).unwrap_or(100).min(1000);
            let desc = su.contains("DESC");
            let query_result = {
                let db = self.db.read();
                db.get_table(&tbl).map(|t| (t.columns.iter().map(|c| c.name.clone()).collect::<Vec<_>>(), t.select(limit, desc)))
            };
            if let Some((names, rows)) = query_result {
                if names.is_empty() { self.send_empty_result().await?; }
                else { self.send_multi_row_desc(&names).await?; for row in &rows { self.send_multi_data_row(&names, row).await?; } }
                self.send_command_complete("SELECT", rows.len() as u32).await?;
            } else if su.contains("VERSION()") {
                self.send_row_desc("version").await?;
                self.send_data_row("PostgreSQL 9.6.0 HunTianDB v1.0").await?;
                self.send_command_complete("SELECT", 1).await?;
            } else if su.contains("CURRENT_DATABASE") {
                self.send_row_desc("current_database").await?;
                self.send_data_row("huntiandb").await?;
                self.send_command_complete("SELECT", 1).await?;
            } else if su.contains("PG_") || su.contains("INFORMATION_SCHEMA") {
                // \dt / pg_catalog discovery — return actual tables
                let names = { self.db.read().table_names() };
                if names.is_empty() {
                    self.send_empty_result().await?;
                } else {
                    self.send_row_desc("table_name").await?;
                    for n in &names { self.send_data_row(n).await?; }
                }
                self.send_command_complete("SELECT", names.len() as u32).await?;
            } else {
                self.send_error(&format!("表 '{}' 不存在", tbl)).await?;
            }
        } else if su.starts_with("CREATE USER ") || su.starts_with("CREATE ROLE ") {
            let rest = s.trim_start_matches("CREATE USER ").trim_start_matches("CREATE ROLE ").trim_start_matches("create user ").trim_start_matches("create role ").trim();
            let name = rest.split_whitespace().next().unwrap_or("").trim_matches('"');
            let pass = self.extract_quoted(rest, "PASSWORD").unwrap_or_else(|| "changeme".into());
            let role = self.extract_quoted(rest, "ROLE").unwrap_or_else(|| "writer".into());
            let result = { self.db.write().create_user(name, &pass, &role) };
            match result {
                Ok(()) => self.send_command_complete("CREATE USER", 1).await?,
                Err(e) => self.send_error(&e).await?,
            }
        } else if su.starts_with("DROP USER ") || su.starts_with("DROP ROLE ") {
            let name = su.trim_start_matches("DROP USER ").trim_start_matches("DROP ROLE ").trim().trim_end_matches(';').trim_matches('"');
            let result = { self.db.write().drop_user(name) };
            match result {
                Ok(()) => self.send_command_complete("DROP USER", 1).await?,
                Err(e) => self.send_error(&e).await?,
            }
        } else if su.starts_with("SHOW USERS") || su.starts_with("LIST USERS") || su == "\\DU" {
            let usernames = { self.db.read().list_users().iter().map(|u| format!("{} ({})", u.username, u.role)).collect::<Vec<_>>() };
            self.send_row_desc("username").await?;
            for u in &usernames { self.send_data_row(u).await?; }
            self.send_command_complete("SELECT", usernames.len() as u32).await?;
        } else {
            self.send_error(&format!("不支持: {}", s)).await?;
        }
        self.send_ready_for_query().await?;
        Ok(())
    }

    // ---- helpers ----

    fn extract_table_name(&self, sql: &str) -> String {
        let su = sql.to_uppercase();
        // 找到 FROM 后第一个非关键字词作为表名
        if let Some(idx) = su.find("FROM ") {
            let after = &su[idx+5..].trim();
            after.split_whitespace()
                .next().unwrap_or("events")
                .trim_matches('"').trim_end_matches(';').trim_end_matches(')')
                .to_lowercase()
        } else { "events".into() }
    }

    fn extract_limit(&self, sql: &str) -> Option<usize> {
        let idx = sql.to_uppercase().rfind("LIMIT ")?;
        sql[idx+6..].trim().split_whitespace().next()?.trim_end_matches(';').parse().ok()
    }

    fn extract_insert_table(&self, sql: &str) -> String {
        let s = sql.trim().trim_start_matches("INSERT INTO ").trim_start_matches("insert into ").trim();
        s.split(|c: char| c==' ' || c=='(').next().unwrap_or("events").trim_matches('"').to_lowercase()
    }

    fn parse_insert_values(&self, sql: &str) -> Vec<serde_json::Value> {
        if let Some(lp) = sql.find("VALUES") {
            let val = &sql[lp+6..].trim();
            if let Some(l) = val.find('(') {
                if let Some(r) = val.rfind(')') {
                    return val[l+1..r].split(',').map(|v| {
                        let v = v.trim().trim_matches('\'');
                        if let Ok(n) = v.parse::<i64>() { serde_json::json!(n) }
                        else if v.eq_ignore_ascii_case("NULL") { serde_json::Value::Null }
                        else { serde_json::json!(v) }
                    }).collect();
                }
            }
        }
        vec![]
    }

    fn extract_quoted(&self, sql: &str, keyword: &str) -> Option<String> {
        let su = sql.to_uppercase();
        let idx = su.find(&format!(" {} ", keyword.to_uppercase()))?;
        let after = &sql[idx + keyword.len() + 2..].trim();
        if after.starts_with('\'') {
            let end = after[1..].find('\'')?;
            Some(after[1..end+1].to_string())
        } else {
            after.split_whitespace().next().map(|s| s.trim_matches('\'').to_string())
        }
    }

    fn parse_columns(&self, s: &str) -> Vec<crate::server::database::ColumnDef> {
        let inner = s.trim_matches(|c: char| c=='(' || c==')' || c==';');
        inner.split(',').filter_map(|c| {
            let parts: Vec<&str> = c.trim().split_whitespace().collect();
            if parts.len() >= 2 {
                Some(crate::server::database::ColumnDef { name: parts[0].to_string(), col_type: parts[1].to_uppercase(), nullable: !c.to_uppercase().contains("NOT NULL") })
            } else { None }
        }).collect()
    }

    async fn respond_describe(&mut self, sql: &str) -> HunTianResult<()> {
        let su = sql.to_uppercase();
        let tbl = self.extract_table_name(sql);
        let exists = { self.db.read().get_table(&tbl).is_some() };
        if exists || su.contains("VERSION") || su.contains("CURRENT_") || su.contains("PG_") {
            self.send_row_desc("result").await?;
        } else {
            self.send_empty_result().await?;
        }
        Ok(())
    }

    // ---- PG wire methods ----

    async fn handle_ssl_request(&mut self) -> HunTianResult<()> {
        self.read_exact(4).await?; let len = self.buffer.get_i32();
        if len == 8 { self.read_exact(4).await?; let _ = self.buffer.get_i32(); self.stream.write_all(&[b'N']).await?; self.stream.flush().await?; }
        else { let s = len.to_be_bytes().to_vec(); self.buffer = BytesMut::with_capacity(4096); self.buffer.extend_from_slice(&s); }
        Ok(())
    }

    async fn read_startup_message(&mut self) -> HunTianResult<StartupMessage> {
        self.read_exact(4).await?; let len = self.buffer.get_i32(); let pl = (len-4) as usize; self.read_exact(pl).await?;
        let proto = self.buffer.get_i32(); let mut p = vec![];
        while self.buffer.has_remaining() { let k = self.read_cstr(); if k.is_empty() { break; } let v = self.read_cstr(); p.push((k,v)); }
        Ok(StartupMessage { protocol_version: proto, parameters: p })
    }

    async fn read_simple_query(&mut self) -> HunTianResult<QueryMessage> {
        self.read_exact(4).await?; let len = self.buffer.get_i32(); let pl = (len-4) as usize; self.read_exact(pl).await?;
        let q = self.read_cstr(); self.buffer.clear(); Ok(QueryMessage { query_string: q })
    }

    async fn read_parse(&mut self) -> HunTianResult<String> {
        self.read_exact(4).await?; let len = self.buffer.get_i32(); let pl = (len-4) as usize; self.read_exact(pl).await?;
        let _ = self.read_cstr(); let sql = self.read_cstr(); self.buffer.clear(); Ok(sql)
    }

    async fn send_authentication_ok(&mut self) -> HunTianResult<()> { self.stream.write_all(&[b'R',0,0,0,8,0,0,0,0]).await?; Ok(()) }
    async fn send_ready_for_query(&mut self) -> HunTianResult<()> { self.stream.write_all(&[b'Z',0,0,0,5,b'I']).await?; Ok(()) }
    async fn send_parse_complete(&mut self) -> HunTianResult<()> { self.stream.write_all(&[b'1',0,0,0,4]).await?; self.stream.flush().await?; Ok(()) }
    async fn send_bind_complete(&mut self) -> HunTianResult<()> { self.stream.write_all(&[b'2',0,0,0,4]).await?; self.stream.flush().await?; Ok(()) }

    async fn send_parameter_status(&mut self, name: &str, value: &str) -> HunTianResult<()> {
        let nb = name.as_bytes(); let vb = value.as_bytes();
        let len = 4 + nb.len() + 1 + vb.len() + 1;
        let mut m = Vec::with_capacity(1+len); m.push(b'S'); m.extend_from_slice(&(len as i32).to_be_bytes()); m.extend_from_slice(nb); m.push(0); m.extend_from_slice(vb); m.push(0);
        self.stream.write_all(&m).await?; Ok(())
    }

    async fn send_backend_key_data(&mut self) -> HunTianResult<()> { self.stream.write_all(&[b'K',0,0,0,12,0,0,0,1,0,0,0,0]).await?; Ok(()) }

    async fn send_command_complete(&mut self, tag: &str, rows: u32) -> HunTianResult<()> {
        let ts = if tag=="INSERT" { format!("INSERT 0 {}", rows) } else { format!("{} {}", tag, rows) };
        let len = 4 + ts.len() + 1; let mut m = Vec::with_capacity(1+len);
        m.push(b'C'); m.extend_from_slice(&(len as i32).to_be_bytes()); m.extend_from_slice(ts.as_bytes()); m.push(0);
        self.stream.write_all(&m).await?; Ok(())
    }

    async fn send_error(&mut self, msg: &str) -> HunTianResult<()> {
        let mut p = vec![b'S']; p.extend_from_slice(b"ERROR"); p.push(0);
        p.push(b'M'); p.extend_from_slice(msg.as_bytes()); p.push(0); p.push(0);
        let len = 4 + p.len(); let mut m = Vec::with_capacity(1+len);
        m.push(b'E'); m.extend_from_slice(&(len as i32).to_be_bytes()); m.extend_from_slice(&p);
        self.stream.write_all(&m).await?; Ok(())
    }

    async fn send_row_desc(&mut self, col_name: &str) -> HunTianResult<()> {
        let n = col_name.as_bytes();
        let len: i32 = 4 + 2 + (n.len() as i32) + 1 + 4 + 2 + 4 + 2 + 4 + 2;
        let mut m = Vec::with_capacity(1+len as usize); m.push(b'T'); m.extend_from_slice(&len.to_be_bytes()); m.extend_from_slice(&1i16.to_be_bytes());
        m.extend_from_slice(n); m.push(0); m.extend_from_slice(&0i32.to_be_bytes()); m.extend_from_slice(&1i16.to_be_bytes());
        m.extend_from_slice(&25i32.to_be_bytes()); m.extend_from_slice(&(-1i16).to_be_bytes()); m.extend_from_slice(&(-1i32).to_be_bytes()); m.extend_from_slice(&0i16.to_be_bytes());
        self.stream.write_all(&m).await?; Ok(())
    }

    async fn send_multi_row_desc(&mut self, cols: &[String]) -> HunTianResult<()> {
        let ncols = cols.len() as i16;
        let body_len: i32 = cols.iter().map(|c| c.len() as i32 + 1 + 4 + 2 + 4 + 2 + 4 + 2).sum();
        let len: i32 = 4 + 2 + body_len;
        let mut m = Vec::with_capacity(1+len as usize); m.push(b'T'); m.extend_from_slice(&len.to_be_bytes()); m.extend_from_slice(&ncols.to_be_bytes());
        for i in 0..ncols {
            let n = cols[i as usize].as_bytes();
            m.extend_from_slice(n); m.push(0); m.extend_from_slice(&0i32.to_be_bytes()); m.extend_from_slice(&(i+1_i16).to_be_bytes());
            m.extend_from_slice(&25i32.to_be_bytes()); m.extend_from_slice(&(-1i16).to_be_bytes()); m.extend_from_slice(&(-1i32).to_be_bytes()); m.extend_from_slice(&0i16.to_be_bytes());
        }
        self.stream.write_all(&m).await?; Ok(())
    }

    async fn send_data_row(&mut self, value: &str) -> HunTianResult<()> {
        let v = value.as_bytes(); let len: i32 = 4 + 2 + 4 + (v.len() as i32);
        let mut m = Vec::with_capacity(1+len as usize); m.push(b'D'); m.extend_from_slice(&len.to_be_bytes()); m.extend_from_slice(&1i16.to_be_bytes()); m.extend_from_slice(&(v.len() as i32).to_be_bytes()); m.extend_from_slice(v);
        self.stream.write_all(&m).await?; Ok(())
    }

    async fn send_multi_data_row(&mut self, cols: &[String], row: &std::collections::HashMap<String, serde_json::Value>) -> HunTianResult<()> {
        let ncols = cols.len() as i16;
        let vals: Vec<String> = cols.iter().map(|c| {
            row.get(c).map(|v| match v {
                serde_json::Value::Null => "NULL".into(),
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                other => other.to_string(),
            }).unwrap_or_else(|| "NULL".into())
        }).collect();
        let vals_len: i32 = vals.iter().map(|v| 4 + v.len() as i32).sum();
        let len: i32 = 4 + 2 + vals_len;
        let mut m = Vec::with_capacity(1+len as usize); m.push(b'D'); m.extend_from_slice(&len.to_be_bytes()); m.extend_from_slice(&ncols.to_be_bytes());
        for v in &vals { m.extend_from_slice(&(v.len() as i32).to_be_bytes()); m.extend_from_slice(v.as_bytes()); }
        self.stream.write_all(&m).await?; Ok(())
    }

    async fn send_empty_result(&mut self) -> HunTianResult<()> { self.stream.write_all(&[b'T',0,0,0,6,0,0]).await?; Ok(()) }

    async fn read_message(&mut self) -> HunTianResult<u8> { self.read_exact(1).await?; Ok(self.buffer.get_u8()) }

    async fn skip_message(&mut self) -> HunTianResult<()> {
        self.read_exact(4).await?; let len = self.buffer.get_i32(); if len > 4 { self.read_exact((len-4) as usize).await?; self.buffer.clear(); } Ok(())
    }

    async fn read_exact(&mut self, n: usize) -> HunTianResult<()> {
        let mut buf = vec![0u8; n]; self.stream.read_exact(&mut buf).await.map_err(|e| HunTianError::Protocol(format!("读取失败: {}", e)))?; self.buffer.extend_from_slice(&buf); Ok(())
    }

    fn read_cstr(&mut self) -> String {
        let mut b = vec![]; while self.buffer.has_remaining() { let ch = self.buffer.get_u8(); if ch == 0 { break; } b.push(ch); }
        String::from_utf8_lossy(&b).into_owned()
    }
}
