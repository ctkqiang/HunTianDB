//! 内存数据库引擎 — 动态表管理
//!
//! 支持 CREATE TABLE, INSERT, SELECT, SHOW TABLES, DESCRIBE。
//! 数据存储在 HashMap 中，表结构自由定义。

use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;
use serde_json::Value;

#[derive(Debug, Clone)]
pub struct ColumnDef {
    pub name: String,
    pub col_type: String,
    pub nullable: bool,
}

#[derive(Debug, Clone)]
pub struct Table {
    pub name: String,
    pub columns: Vec<ColumnDef>,
    pub rows: Vec<HashMap<String, Value>>,
}

impl Table {
    pub fn new(name: &str, columns: Vec<ColumnDef>) -> Self {
        Self { name: name.to_string(), columns, rows: Vec::new() }
    }

    pub fn insert(&mut self, values: Vec<Value>) -> Result<(), String> {
        if values.len() != self.columns.len() {
            return Err(format!("列数不匹配: 需要 {}, 提供了 {}", self.columns.len(), values.len()));
        }
        let mut row = HashMap::new();
        for (i, col) in self.columns.iter().enumerate() {
            row.insert(col.name.clone(), values[i].clone());
        }
        self.rows.push(row);
        Ok(())
    }

    pub fn select(&self, limit: usize, desc: bool) -> Vec<HashMap<String, Value>> {
        let total = self.rows.len();
        if total == 0 { return vec![]; }
        let count = limit.min(total);
        let mut result: Vec<HashMap<String, Value>> = if desc {
            self.rows.iter().rev().take(count).cloned().collect()
        } else {
            self.rows.iter().take(count).cloned().collect()
        };
        if desc { result.reverse(); }
        result
    }
}

/// 用户记录 — SCRAM-SHA-256 加密存储
#[derive(Debug, Clone)]
pub struct DbUser {
    pub username: String,
    pub password_hash: String,   // SCRAM-SHA-256 格式: "SCRAM-SHA-256$<salt>$<stored_key>$<server_key>$<iterations>"
    pub role: String,            // admin / writer / reader
}

pub struct Database {
    pub tables: HashMap<String, Table>,
    pub users: HashMap<String, DbUser>,
}

impl Database {
    pub fn new() -> Self {
        let mut db = Self { tables: HashMap::new(), users: HashMap::new() };
        // 预置默认用户
        for (user, pass, role) in [
            ("admin", "admin123", "admin"),
            ("root", "root123", "admin"),
            ("writer", "writer123", "writer"),
            ("reader", "reader123", "reader"),
        ] {
            let scram = crate::auth::scram::ScramServer::from_password(pass).unwrap();
            db.users.insert(user.to_string(), DbUser {
                username: user.to_string(),
                password_hash: format!("SCRAM-SHA-256${}${}${}${}",
                    scram.stored_salt, scram.stored_key, scram.server_key, scram.iterations),
                role: role.to_string(),
            });
        }
        // 预置 events 表
        db.create_table("events", vec![
            ColumnDef { name: "id".into(), col_type: "BIGINT".into(), nullable: false },
            ColumnDef { name: "timestamp".into(), col_type: "BIGINT".into(), nullable: false },
            ColumnDef { name: "user_id".into(), col_type: "INT32".into(), nullable: false },
            ColumnDef { name: "session_id".into(), col_type: "INT64".into(), nullable: false },
            ColumnDef { name: "event_type".into(), col_type: "INT8".into(), nullable: false },
            ColumnDef { name: "lock_id".into(), col_type: "INT32".into(), nullable: false },
            ColumnDef { name: "zone".into(), col_type: "INT8".into(), nullable: false },
            ColumnDef { name: "region".into(), col_type: "INT8".into(), nullable: false },
            ColumnDef { name: "status_code".into(), col_type: "INT16".into(), nullable: false },
            ColumnDef { name: "ip_address".into(), col_type: "INT32".into(), nullable: false },
            ColumnDef { name: "parent_event_id".into(), col_type: "INT64".into(), nullable: false },
            ColumnDef { name: "error_msg".into(), col_type: "VARCHAR".into(), nullable: true },
            ColumnDef { name: "metadata_json".into(), col_type: "BYTEA".into(), nullable: true },
        ]);
        db
    }

    pub fn create_table(&mut self, name: &str, columns: Vec<ColumnDef>) -> Result<(), String> {
        let name_lower = name.to_lowercase();
        if self.tables.contains_key(&name_lower) {
            return Err(format!("表 '{}' 已存在", name));
        }
        self.tables.insert(name_lower.clone(), Table::new(&name_lower, columns));
        Ok(())
    }

    pub fn get_table(&self, name: &str) -> Option<&Table> {
        self.tables.get(&name.to_lowercase())
    }

    pub fn get_table_mut(&mut self, name: &str) -> Option<&mut Table> {
        self.tables.get_mut(&name.to_lowercase())
    }

    pub fn table_names(&self) -> Vec<String> {
        let mut names: Vec<String> = self.tables.keys().cloned().collect();
        names.sort();
        names
    }

    pub fn drop_table(&mut self, name: &str) -> Result<(), String> {
        let name_lower = name.to_lowercase();
        if !self.tables.contains_key(&name_lower) {
            return Err(format!("表 '{}' 不存在", name));
        }
        self.tables.remove(&name_lower);
        Ok(())
    }

    // ---- 用户管理 ----

    pub fn create_user(&mut self, username: &str, password: &str, role: &str) -> Result<(), String> {
        let name = username.to_lowercase();
        if self.users.contains_key(&name) { return Err(format!("用户 '{}' 已存在", username)); }
        if password.len() < 6 { return Err("密码至少6位".into()); }
        let scram = crate::auth::scram::ScramServer::from_password(password)
            .map_err(|e| format!("密码哈希失败: {}", e))?;
        self.users.insert(name.clone(), DbUser {
            username: name,
            password_hash: format!("SCRAM-SHA-256${}${}${}${}",
                scram.stored_salt, scram.stored_key, scram.server_key, scram.iterations),
            role: role.to_string(),
        });
        Ok(())
    }

    pub fn drop_user(&mut self, username: &str) -> Result<(), String> {
        let name = username.to_lowercase();
        if !self.users.contains_key(&name) { return Err(format!("用户 '{}' 不存在", username)); }
        self.users.remove(&name);
        Ok(())
    }

    pub fn verify_password(&self, username: &str, password: &str) -> bool {
        let name = username.to_lowercase();
        self.users.get(&name).map(|u| {
            let parts: Vec<&str> = u.password_hash.split('$').collect();
            if parts.len() < 5 { return false; }
            // Simple PBKDF2 verification via re-hash and compare stored_key
            crate::auth::scram::ScramServer::verify_password(password, &u.password_hash)
        }).unwrap_or(false)
    }

    pub fn get_user_role(&self, username: &str) -> Option<String> {
        self.users.get(&username.to_lowercase()).map(|u| u.role.clone())
    }

    pub fn list_users(&self) -> Vec<&DbUser> {
        let mut v: Vec<&DbUser> = self.users.values().collect();
        v.sort_by(|a, b| a.username.cmp(&b.username));
        v
    }
}

pub type SharedDb = Arc<RwLock<Database>>;
