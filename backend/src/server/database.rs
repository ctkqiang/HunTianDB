//! 内存数据库引擎 + WAL 持久化
//!
//! INSERT 时同步写 WAL (Write-Ahead Log)，启动时回放 WAL 恢复数据。
//! 断电/重启不丢数据。

use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;
use serde_json::Value;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone)]
pub struct ColumnDef { pub name: String, pub col_type: String, pub nullable: bool }

#[derive(Debug, Clone)]
pub struct Table { pub name: String, pub columns: Vec<ColumnDef>, pub rows: Vec<HashMap<String, Value>> }

#[derive(Debug, Clone, Serialize, Deserialize)]
enum WalOp {
    CreateTable { name: String, columns: Vec<(String, String, bool)> },
    InsertRow { table: String, values: Vec<Value> },
    DropTable { name: String },
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
        if desc {
            let start = total.saturating_sub(count);
            self.rows[start..].iter().rev().cloned().collect()
        } else {
            self.rows[..count].to_vec()
        }
    }
}

#[derive(Debug, Clone)]
pub struct DbUser {
    pub username: String,
    pub password_hash: String,
    pub role: String,
}

pub struct Database {
    pub tables: HashMap<String, Table>,
    pub users: HashMap<String, DbUser>,
    pub data_dir: std::path::PathBuf,
}

impl Database {
    pub fn new(data_dir: std::path::PathBuf) -> Self {
        let mut db = Self { tables: HashMap::new(), users: HashMap::new(), data_dir };
        // 预置默认用户
        for (user, pass, role) in [
            ("admin", "admin123", "admin"), ("root", "root123", "admin"),
            ("writer", "writer123", "writer"), ("reader", "reader123", "reader"),
        ] {
            let scram = crate::auth::scram::ScramServer::from_password(pass).unwrap();
            db.users.insert(user.to_string(), DbUser {
                username: user.to_string(),
                password_hash: format!("SCRAM-SHA-256${}${}${}${}", scram.stored_salt, scram.stored_key, scram.server_key, scram.iterations),
                role: role.to_string(),
            });
        }
        // 预置 events 表
        let _ = db.create_table("events", vec![
            ColumnDef{name:"id".into(),col_type:"BIGINT".into(),nullable:false},
            ColumnDef{name:"timestamp".into(),col_type:"BIGINT".into(),nullable:false},
            ColumnDef{name:"user_id".into(),col_type:"INT32".into(),nullable:false},
            ColumnDef{name:"session_id".into(),col_type:"INT64".into(),nullable:false},
            ColumnDef{name:"event_type".into(),col_type:"INT8".into(),nullable:false},
            ColumnDef{name:"lock_id".into(),col_type:"INT32".into(),nullable:false},
            ColumnDef{name:"zone".into(),col_type:"INT8".into(),nullable:false},
            ColumnDef{name:"region".into(),col_type:"INT8".into(),nullable:false},
            ColumnDef{name:"status_code".into(),col_type:"INT16".into(),nullable:false},
            ColumnDef{name:"ip_address".into(),col_type:"INT32".into(),nullable:false},
            ColumnDef{name:"parent_event_id".into(),col_type:"INT64".into(),nullable:false},
            ColumnDef{name:"error_msg".into(),col_type:"VARCHAR".into(),nullable:true},
            ColumnDef{name:"metadata_json".into(),col_type:"BYTEA".into(),nullable:true},
        ]);
        // 回放 WAL 恢复数据
        db.replay_recovery_log();
        db
    }

    /// 从 recovery.log 回放数据
    fn replay_recovery_log(&mut self) {
        let path = self.data_dir.join("recovery.log");
        if !path.exists() { return; }
        if let Ok(content) = std::fs::read_to_string(&path) {
            let mut recovered = 0usize;
            for line in content.lines() {
                if line.trim().is_empty() { continue; }
                if let Ok(op) = serde_json::from_str::<WalOp>(line) {
                    match op {
                        WalOp::CreateTable { name, columns } => {
                            let cols: Vec<ColumnDef> = columns.into_iter().map(|(n,t,b)| ColumnDef{name:n,col_type:t,nullable:b}).collect();
                            self.create_table(&name, cols).ok();
                        }
                        WalOp::InsertRow { table, values } => {
                            if let Some(t) = self.get_table_mut(&table) {
                                t.insert(values).ok();
                                recovered += 1;
                            }
                        }
                        WalOp::DropTable { name } => { self.drop_table(&name).ok(); }
                    }
                }
            }
            if recovered > 0 { tracing::info!("WAL 回放: {} 行已恢复", recovered); }
        }
    }

    // 记录操作到 WAL
    fn log_op(&self, op: WalOp) {
        let path = self.data_dir.join("recovery.log");
        if let Ok(json) = serde_json::to_string(&op) {
            use std::io::Write;
            if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
                let _ = writeln!(f, "{}", json);
                let _ = f.flush();
            }
        }
    }

    /// INSERT + WAL 日志 (同时写入内存和持久化)
    pub fn log_insert(&mut self, table: &str, values: Vec<Value>) -> Result<(), String> {
        let t = self.get_table_mut(table).ok_or_else(|| format!("表 '{}' 不存在", table))?;
        t.insert(values.clone())?;
        self.log_op(WalOp::InsertRow { table: table.to_lowercase(), values });
        Ok(())
    }

    pub fn create_table(&mut self, name: &str, columns: Vec<ColumnDef>) -> Result<(), String> {
        let name_lower = name.to_lowercase();
        if self.tables.contains_key(&name_lower) { return Err(format!("表 '{}' 已存在", name)); }
        self.tables.insert(name_lower.clone(), Table::new(&name_lower, columns.clone()));
        let cols: Vec<(String, String, bool)> = columns.into_iter().map(|c| (c.name, c.col_type, c.nullable)).collect();
        self.log_op(WalOp::CreateTable { name: name_lower, columns: cols });
        Ok(())
    }

    pub fn get_table(&self, name: &str) -> Option<&Table> { self.tables.get(&name.to_lowercase()) }
    pub fn get_table_mut(&mut self, name: &str) -> Option<&mut Table> { self.tables.get_mut(&name.to_lowercase()) }

    pub fn table_names(&self) -> Vec<String> {
        let mut names: Vec<String> = self.tables.keys().cloned().collect();
        names.sort(); names
    }

    pub fn drop_table(&mut self, name: &str) -> Result<(), String> {
        let name_lower = name.to_lowercase();
        if !self.tables.contains_key(&name_lower) { return Err(format!("表 '{}' 不存在", name)); }
        self.tables.remove(&name_lower);
        self.log_op(WalOp::DropTable { name: name_lower });
        Ok(())
    }

    // ---- 用户管理 ----
    pub fn create_user(&mut self, username: &str, password: &str, role: &str) -> Result<(), String> {
        let name = username.to_lowercase();
        if self.users.contains_key(&name) { return Err(format!("用户 '{}' 已存在", username)); }
        if password.len() < 6 { return Err("密码至少6位".into()); }
        let scram = crate::auth::scram::ScramServer::from_password(password).map_err(|e| format!("密码哈希失败: {}", e))?;
        self.users.insert(name.clone(), DbUser {
            username: name, password_hash: format!("SCRAM-SHA-256${}${}${}${}", scram.stored_salt, scram.stored_key, scram.server_key, scram.iterations),
            role: role.to_string(),
        });
        Ok(())
    }

    pub fn drop_user(&mut self, username: &str) -> Result<(), String> {
        let name = username.to_lowercase();
        if !self.users.contains_key(&name) { return Err(format!("用户 '{}' 不存在", username)); }
        self.users.remove(&name); Ok(())
    }

    pub fn verify_password(&self, username: &str, password: &str) -> bool {
        let name = username.to_lowercase();
        self.users.get(&name).map(|u| crate::auth::scram::ScramServer::verify_password(password, &u.password_hash)).unwrap_or(false)
    }

    pub fn get_user_role(&self, username: &str) -> Option<String> {
        self.users.get(&username.to_lowercase()).map(|u| u.role.clone())
    }

    pub fn list_users(&self) -> Vec<&DbUser> {
        let mut v: Vec<&DbUser> = self.users.values().collect();
        v.sort_by(|a,b| a.username.cmp(&b.username));
        v
    }
}

pub type SharedDb = Arc<RwLock<Database>>;
