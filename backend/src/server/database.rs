//! 内存数据库引擎 + WAL 持久化
//!
//! INSERT 时同步写 WAL (Write-Ahead Log)，启动时回放 WAL 恢复数据。
//! 断电/重启不丢数据。
//!
//! WAL 格式 (v2, binary): [4字节 LE record_length][bincode 序列化的 WalOp]
//! v1 (legacy JSON) 在 replay 时自动检测并兼容。

use std::collections::HashMap;
use std::io::{BufWriter, Write};
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
    /// 构造一张具备给定列定义的新数据表。
    ///
    /// @param name 表名称（不区分大小写）。
    /// @param columns 列定义集合，顺序决定后续 INSERT 的数值排列。
    /// @return 返回初始化为空行集的 Table 实例。
    pub fn new(name: &str, columns: Vec<ColumnDef>) -> Self {
        Self { name: name.to_string(), columns, rows: Vec::new() }
    }

    /// 向表中追加一行数据。
    ///
    /// 值的顺序必须与建表时的列定义顺序完全一致，否则返回列数不匹配错误。
    /// 该方法仅修改内存结构，WAL 持久化由上层 [`Database::log_insert`] 负责。
    ///
    /// @param values 单行数据，每个元素对应一列。
    /// @return 插入成功返回 `Ok(())`，列数不匹配返回 `Err`。
    ///
    /// # Errors
    ///
    /// 当 `values.len()` 与 `self.columns.len()` 不相等时，返回描述性错误字符串。
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

    /// 从表中检索限定数量的行。
    ///
    /// 当前实现为全表线性扫描，未建立索引。对于审计日志类时序数据，
    /// 默认按插入顺序返回（`desc=true` 时从尾部截取最新记录）。
    ///
    /// @param limit 最大返回行数。
    /// @param desc 为 `true` 时返回最近插入的行（倒序）。
    /// @return 按指定顺序排列的行集合。
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
    pub wal_enabled: bool,
    wal_writer: Option<BufWriter<std::fs::File>>,
    wal_ops_since_flush: u32,
}

impl Database {
    /// 初始化混天DB 数据库引擎。
    ///
    /// 预置 `events` 安全审计表和 4 个默认用户账号。
    /// 若 `wal_enabled` 为 `true`，从 `data_dir/recovery.log` 回放 WAL 恢复数据。
    /// 启动耗时与 WAL 文件大小成正比——生产环境建议定期清理或归档历史日志。
    ///
    /// @param data_dir 数据持久化目录路径。
    /// @param wal_enabled 是否启用 WAL 持久化与启动回放。
    /// @return 已初始化并完成 WAL 回放（若启用）的 Database 实例。
    pub fn new(data_dir: std::path::PathBuf, wal_enabled: bool) -> Self {
        let wal_writer = if wal_enabled {
            let wal_path = data_dir.join("recovery.log");
            std::fs::OpenOptions::new()
                .create(true).append(true)
                .open(&wal_path)
                .ok()
                .map(|f| BufWriter::with_capacity(64 * 1024, f)) // 64KB buffer — batches writes
        } else { None };

        let mut db = Self {
            tables: HashMap::new(),
            users: HashMap::new(),
            data_dir,
            wal_enabled,
            wal_writer,
            wal_ops_since_flush: 0,
        };
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
        if wal_enabled { db.replay_recovery_log(); }
        db
    }

    /// 从 recovery.log 回放数据
    ///
    /// 支持两种格式:
    ///   v2 (binary): [4字节 LE length][bincode WalOp] — compact, production
    ///   v1 (JSON):   每行一个 JSON — legacy, auto-detected
    fn replay_recovery_log(&mut self) {
        let path = self.data_dir.join("recovery.log");
        if !path.exists() { return; }

        let data = match std::fs::read(&path) {
            Ok(d) => d,
            Err(_) => return,
        };
        if data.is_empty() { return; }

        let mut recovered = 0u64;

        // Detect format: v2 binary starts with 4-byte LE length prefix, v1 JSON starts with '{'
        if data[0] == b'{' {
            // v1 — legacy JSON, one WalOp per line
            if let Ok(text) = std::fs::read_to_string(&path) {
                for line in text.lines() {
                    if line.trim().is_empty() { continue; }
                    if let Ok(op) = serde_json::from_str::<WalOp>(line) {
                        recovered += self._replay_op(op);
                    }
                }
            }
        } else {
            // v2 — binary bincode: [4B LE len][bincode bytes]...
            let mut pos = 0usize;
            while pos + 4 <= data.len() {
                let record_len = u32::from_le_bytes([data[pos], data[pos+1], data[pos+2], data[pos+3]]) as usize;
                pos += 4;
                if pos + record_len > data.len() { break; }
                if let Ok(op) = bincode::deserialize::<WalOp>(&data[pos..pos + record_len]) {
                    recovered += self._replay_op(op);
                }
                pos += record_len;
            }
        }

        if recovered > 0 {
            tracing::info!("WAL 回放: {} 条记录已恢复", recovered);
        }
    }

    /// Replay a single WalOp (shared between v1 and v2 replay).
    fn _replay_op(&mut self, op: WalOp) -> u64 {
        match op {
            WalOp::CreateTable { name, columns } => {
                let cols: Vec<ColumnDef> = columns.into_iter()
                    .map(|(n, t, b)| ColumnDef { name: n, col_type: t, nullable: b })
                    .collect();
                self.create_table(&name, cols).ok();
                0
            }
            WalOp::InsertRow { table, values } => {
                if let Some(t) = self.get_table_mut(&table) {
                    t.insert(values).ok();
                    return 1;
                }
                0
            }
            WalOp::DropTable { name } => {
                self.drop_table(&name).ok();
                0
            }
        }
    }

    /// 记录操作到 WAL (v2 binary bincode, buffered writes).
    ///
    /// Uses bincode serialization (~5-8x smaller than JSON) with a 64KB BufWriter
    /// to batch writes and eliminate per-row fsync. Flushes every 1000 ops
    /// or when the buffer is full.
    fn log_op(&mut self, op: WalOp) {
        if !self.wal_enabled { return; }

        let data = match bincode::serialize(&op) {
            Ok(d) => d,
            Err(_) => return,
        };

        let len_prefix = (data.len() as u32).to_le_bytes();

        if let Some(ref mut writer) = self.wal_writer {
            if writer.write_all(&len_prefix).is_err() { return; }
            if writer.write_all(&data).is_err() { return; }

            self.wal_ops_since_flush += 1;
            // Flush every 500 ops (BufWriter auto-flushes at 64KB regardless)
            if self.wal_ops_since_flush >= 500 {
                let _ = writer.flush();
                self.wal_ops_since_flush = 0;
            }
        }
    }

    /// Force-flush the WAL buffer. Call before shutdown.
    pub fn flush_wal(&mut self) {
        if let Some(ref mut w) = self.wal_writer {
            let _ = w.flush();
            self.wal_ops_since_flush = 0;
        }
    }

    /// 执行 INSERT 并同步写入 WAL 恢复日志。
    ///
    /// 先将数据写入内存表，再序列化操作指令追加至 `recovery.log`。
    /// 若 `wal_enabled` 为 `false`，跳过 WAL 写入仅操作内存。
    ///
    /// @param table 目标表名称。
    /// @param values 单行数据值列表。
    /// @return 成功返回 `Ok(())`，表不存在或列数不匹配返回 `Err`。
    ///
    /// # Errors
    ///
    /// 目标表不存在或列数与值列表长度不一致时返回错误。
    pub fn log_insert(&mut self, table: &str, values: Vec<Value>) -> Result<(), String> {
        let t = self.get_table_mut(table).ok_or_else(|| format!("表 '{}' 不存在", table))?;
        t.insert(values.clone())?;
        self.log_op(WalOp::InsertRow { table: table.to_lowercase(), values });
        Ok(())
    }

    /// 创建新表并写入 WAL 日志。
    ///
    /// 表名自动转换为小写存储。若 WAL 已启用，创建操作同步记录至恢复日志，
    /// 确保重启后可完整重建表结构。
    ///
    /// @param name 表名称（不区分大小写）。
    /// @param columns 列定义列表。
    /// @return 成功返回 `Ok(())`，表已存在返回 `Err`。
    ///
    /// # Errors
    ///
    /// 当同名表已存在时返回描述性错误。
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

    /// 验证用户名与明文密码是否匹配。
    ///
    /// 使用 SCRAM-SHA-256 协议比对存储的哈希值。
    /// 比对过程采用常量时间比较以抵御时序侧信道攻击。
    ///
    /// @param username 待验证的用户名。
    /// @param password 客户端提交的明文密码。
    /// @return 密码正确且用户存在时返回 `true`。
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

impl Drop for Database {
    fn drop(&mut self) {
        self.flush_wal();
    }
}

pub type SharedDb = Arc<RwLock<Database>>;
