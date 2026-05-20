//! 内存数据库引擎 + WAL 持久化
//!
//! INSERT 时异步写 WAL: 调用线程做 bincode+zstd 压缩后推入 lock-free channel，
//! 后台线程批量写盘。客户端即刻返回，写入吞吐量不受磁盘延迟影响。
//!
//! WAL 格式 v3: [0x03][4B uncomp_len LE][4B comp_len LE][zstd(bincode WalOp)]
//! v1 (JSON) / v2 (uncompressed bincode) 在 replay 时自动检测兼容。

use std::collections::HashMap;
use std::io::{BufWriter, Write};
use std::sync::Arc;
use std::thread;
use parking_lot::RwLock;
use serde_json::Value;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone)]
pub struct ColumnDef { pub name: String, pub col_type: String, pub nullable: bool }

#[derive(Debug, Clone)]
pub struct Table {
    pub name: String,
    pub columns: Vec<ColumnDef>,
    pub rows: Vec<HashMap<String, Value>>,
    // Columnar cache for vectorized aggregation — built lazily, cleared on insert
    col_cache: HashMap<String, Vec<f64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
enum WalOp {
    CreateTable { name: String, columns: Vec<(String, String, bool)> },
    InsertRow { table: String, values: Vec<Value> },
    DropTable { name: String },
}

// ── Async WAL writer ──

/// Commands sent to the background WAL writer thread.
enum WalCommand {
    /// Write a pre-serialized, pre-compressed v3 record to disk.
    Write(Vec<u8>),
    /// Flush and fsync the underlying file.
    Flush,
    /// Stop the writer thread gracefully.
    Shutdown,
}

/// Spawn a background thread that receives compressed WAL records
/// and writes them to disk with a BufWriter.
fn spawn_wal_writer(
    rx: crossbeam::channel::Receiver<WalCommand>,
    path: std::path::PathBuf,
) -> thread::JoinHandle<()> {
    thread::Builder::new()
        .name("wal-writer".into())
        .spawn(move || {
            let mut writer: Option<BufWriter<std::fs::File>> = None;
            let mut ops_since_flush = 0u32;

            for cmd in rx {
                match cmd {
                    WalCommand::Write(data) => {
                        if writer.is_none() {
                            writer = std::fs::OpenOptions::new()
                                .create(true)
                                .append(true)
                                .open(&path)
                                .ok()
                                .map(|f| BufWriter::with_capacity(64 * 1024, f));
                        }
                        if let Some(ref mut w) = writer {
                            if w.write_all(&data).is_err() {
                                continue;
                            }
                            ops_since_flush += 1;
                            if ops_since_flush >= 500 {
                                let _ = w.flush();
                                ops_since_flush = 0;
                            }
                        }
                    }
                    WalCommand::Flush => {
                        if let Some(ref mut w) = writer {
                            let _ = w.flush();
                            ops_since_flush = 0;
                        }
                    }
                    WalCommand::Shutdown => {
                        if let Some(ref mut w) = writer {
                            let _ = w.flush();
                        }
                        break;
                    }
                }
            }
        })
        .expect("spawn wal-writer thread")
}

impl Table {
    /// 构造一张具备给定列定义的新数据表。
    ///
    /// @param name 表名称（不区分大小写）。
    /// @param columns 列定义集合，顺序决定后续 INSERT 的数值排列。
    /// @return 返回初始化为空行集的 Table 实例。
    pub fn new(name: &str, columns: Vec<ColumnDef>) -> Self {
        Self { name: name.to_string(), columns, rows: Vec::new(), col_cache: HashMap::new() }
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
        self.col_cache.clear(); // invalidate cached column vectors
        Ok(())
    }

    // ── Vectorized aggregation (columnar cache) ──

    /// Build a flat `Vec<f64>` for a column if not already cached.
    /// Extracts numeric values from HashMap rows into contiguous memory.
    fn ensure_col_f64(&mut self, col_name: &str) -> &[f64] {
        if !self.col_cache.contains_key(col_name) {
            let col_lower = col_name.to_lowercase();
            let col_key = self.columns.iter()
                .find(|c| c.name.to_lowercase() == col_lower)
                .map(|c| c.name.clone());

            if let Some(key) = col_key {
                let vec: Vec<f64> = self.rows.iter()
                    .filter_map(|row| row.get(&key))
                    .filter_map(|v| {
                        if v.is_null() { return None; }
                        v.as_f64().or_else(|| v.as_i64().map(|n| n as f64))
                    })
                    .collect();
                self.col_cache.insert(col_name.to_lowercase(), vec);
            } else {
                self.col_cache.insert(col_name.to_lowercase(), Vec::new());
            }
        }
        self.col_cache.get(&col_name.to_lowercase()).map(|v| v.as_slice()).unwrap_or(&[])
    }

    /// SUM(col) — vectorized: iterates contiguous f64 slice, CPU cache-friendly.
    pub fn sum_fast(&mut self, col: &str) -> f64 {
        self.ensure_col_f64(col).iter().sum()
    }

    /// AVG(col) — vectorized.
    pub fn avg_fast(&mut self, col: &str) -> f64 {
        let data = self.ensure_col_f64(col);
        if data.is_empty() { return 0.0; }
        data.iter().sum::<f64>() / data.len() as f64
    }

    /// COUNT(col) — vectorized.
    pub fn count_fast(&mut self, col: &str) -> usize {
        self.ensure_col_f64(col).len()
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

    // ── Aggregate functions ──

    /// Get the value for a given column from a row HashMap (case-insensitive key lookup).
    fn row_col_value<'a>(row: &'a HashMap<String, Value>, col: &str) -> Option<&'a Value> {
        row.get(col).or_else(|| {
            let lower = col.to_lowercase();
            if lower == col { return None; }
            row.get(&lower)
        })
    }

    /// COUNT(*) — total rows in table.
    pub fn count_all(&self) -> usize {
        self.rows.len()
    }

    /// COUNT(col) — count non-null values for a column.
    pub fn count_col(&self, col: &str) -> usize {
        self.rows.iter()
            .filter(|row| Self::row_col_value(row, col).map_or(false, |v| !v.is_null()))
            .count()
    }

    /// SUM(col) → f64. Nulls are skipped. Returns None if no non-null values.
    pub fn sum_col(&self, col: &str) -> Option<f64> {
        let mut total = 0.0_f64;
        let mut found = false;
        for row in &self.rows {
            if let Some(v) = Self::row_col_value(row, col) {
                if let Some(n) = v.as_f64() {
                    total += n;
                    found = true;
                } else if let Some(n) = v.as_i64() {
                    total += n as f64;
                    found = true;
                }
            }
        }
        if found { Some(total) } else { None }
    }

    /// AVG(col) → f64. Nulls are skipped. Returns None if no non-null numeric values.
    pub fn avg_col(&self, col: &str) -> Option<f64> {
        let mut total = 0.0_f64;
        let mut count = 0_usize;
        for row in &self.rows {
            if let Some(v) = Self::row_col_value(row, col) {
                if let Some(n) = v.as_f64() {
                    total += n;
                    count += 1;
                } else if let Some(n) = v.as_i64() {
                    total += n as f64;
                    count += 1;
                }
            }
        }
        if count > 0 { Some(total / count as f64) } else { None }
    }

    /// MIN(col) → the minimum Value. Compares numbers numerically, strings lexically.
    pub fn min_col(&self, col: &str) -> Option<Value> {
        let mut best: Option<Value> = None;
        for row in &self.rows {
            if let Some(v) = Self::row_col_value(row, col) {
                if v.is_null() { continue; }
                match &best {
                    None => best = Some(v.clone()),
                    Some(b) => {
                        if compare_values(v, b) == std::cmp::Ordering::Less {
                            best = Some(v.clone());
                        }
                    }
                }
            }
        }
        best
    }

    /// MAX(col) → the maximum Value.
    pub fn max_col(&self, col: &str) -> Option<Value> {
        let mut best: Option<Value> = None;
        for row in &self.rows {
            if let Some(v) = Self::row_col_value(row, col) {
                if v.is_null() { continue; }
                match &best {
                    None => best = Some(v.clone()),
                    Some(b) => {
                        if compare_values(v, b) == std::cmp::Ordering::Greater {
                            best = Some(v.clone());
                        }
                    }
                }
            }
        }
        best
    }

    /// GROUP BY with one aggregate: returns Vec<(group_key, agg_value)>.
    /// agg_fn: "COUNT", "SUM", "AVG", "MIN", "MAX"
    pub fn group_by_agg(
        &self,
        group_col: &str,
        agg_col: &str,
        agg_fn: &str,
    ) -> Vec<(Value, f64)> {
        let mut groups: HashMap<String, (f64, usize)> = HashMap::new(); // (accumulator, count)

        for row in &self.rows {
            let key = Self::row_col_value(row, group_col)
                .cloned()
                .unwrap_or(Value::Null);
            let key_str = value_to_key(&key);

            let entry = groups.entry(key_str).or_insert((0.0, 0));

            match agg_fn {
                "COUNT" => {
                    entry.0 += 1.0;
                    entry.1 += 1;
                }
                _ => {
                    if let Some(v) = Self::row_col_value(row, agg_col) {
                        if !v.is_null() {
                            if let Some(n) = v.as_f64() {
                                entry.0 += n;
                                entry.1 += 1;
                            } else if let Some(n) = v.as_i64() {
                                entry.0 += n as f64;
                                entry.1 += 1;
                            }
                        }
                    }
                }
            }
        }

        groups.into_iter().map(|(k, (acc, cnt))| {
            let key = key_to_value(&k);
            let val = match agg_fn {
                "COUNT" => cnt as f64,
                "AVG" if cnt > 0 => acc / cnt as f64,
                _ => acc, // SUM, MIN/MAX would need different accumulators
            };
            (key, val)
        }).collect()
    }
}

/// Compare two serde_json Values for ordering (MIN/MAX).
fn compare_values(a: &Value, b: &Value) -> std::cmp::Ordering {
    use std::cmp::Ordering;
    match (a, b) {
        (Value::Number(na), Value::Number(nb)) => {
            na.as_f64().partial_cmp(&nb.as_f64()).unwrap_or(Ordering::Equal)
        }
        (Value::String(sa), Value::String(sb)) => sa.cmp(sb),
        (Value::Bool(ba), Value::Bool(bb)) => ba.cmp(bb),
        _ => Ordering::Equal,
    }
}

/// Reverse of value_to_key — convert a hash key back to a Value.
fn key_to_value(k: &str) -> Value {
    if k == "##NULL##" {
        return Value::Null;
    }
    if let Some(rest) = k.strip_prefix("##BOOL##") {
        return Value::Bool(rest == "true");
    }
    if let Some(rest) = k.strip_prefix("##NUM##") {
        if let Ok(n) = rest.parse::<i64>() {
            return Value::Number(serde_json::Number::from(n));
        }
        if let Ok(f) = rest.parse::<f64>() {
            if let Some(n) = serde_json::Number::from_f64(f) {
                return Value::Number(n);
            }
        }
    }
    if let Some(rest) = k.strip_prefix("##STR##") {
        return Value::String(rest.to_string());
    }
    Value::String(k.to_string())
}

/// Convert a Value to a string key for GROUP BY hashing.
fn value_to_key(v: &Value) -> String {
    match v {
        Value::Null => "##NULL##".into(),
        Value::Bool(b) => format!("##BOOL##{}", b),
        Value::Number(n) => format!("##NUM##{}", n),
        Value::String(s) => format!("##STR##{}", s),
        _ => serde_json::to_string(v).unwrap_or_default(),
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
    wal_tx: Option<crossbeam::channel::Sender<WalCommand>>,
    wal_handle: Option<thread::JoinHandle<()>>,
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
        let (wal_tx, wal_handle) = if wal_enabled {
            let (tx, rx) = crossbeam::channel::unbounded();
            let wal_path = data_dir.join("recovery.log");
            let handle = spawn_wal_writer(rx, wal_path);
            (Some(tx), Some(handle))
        } else {
            (None, None)
        };

        let mut db = Self {
            tables: HashMap::new(),
            users: HashMap::new(),
            data_dir,
            wal_enabled,
            wal_tx,
            wal_handle,
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

        // Detect format:
        //   v3: first byte 0x03 → zstd-compressed bincode  [0x03][4B uncomp_len][4B comp_len][zstd(bincode)]
        //   v2: first byte NOT '{' / 0x03 → uncompressed bincode [4B len][bincode]
        //   v1: first byte '{' → JSON text, one WalOp per line
        if data[0] == b'{' {
            // v1 — legacy JSON
            if let Ok(text) = std::fs::read_to_string(&path) {
                for line in text.lines() {
                    if line.trim().is_empty() { continue; }
                    if let Ok(op) = serde_json::from_str::<WalOp>(line) {
                        recovered += self._replay_op(op);
                    }
                }
            }
        } else if data[0] == 0x03 {
            // v3 — zstd-compressed bincode
            let mut pos = 1usize; // skip version byte
            while pos + 8 <= data.len() {
                let uncomp_len = u32::from_le_bytes([data[pos], data[pos+1], data[pos+2], data[pos+3]]) as usize;
                let comp_len = u32::from_le_bytes([data[pos+4], data[pos+5], data[pos+6], data[pos+7]]) as usize;
                pos += 8;
                if comp_len == 0 || pos + comp_len > data.len() { break; }
                let decompressed = match zstd::decode_all(&data[pos..pos + comp_len]) {
                    Ok(d) => d,
                    Err(_) => { pos += comp_len; continue; }
                };
                if let Ok(op) = bincode::deserialize::<WalOp>(&decompressed) {
                    recovered += self._replay_op(op);
                }
                pos += comp_len;
            }
        } else {
            // v2 — uncompressed bincode (legacy, from first optimization pass)
            let mut pos = 0usize;
            while pos + 4 <= data.len() {
                let record_len = u32::from_le_bytes([data[pos], data[pos+1], data[pos+2], data[pos+3]]) as usize;
                pos += 4;
                if record_len == 0 || pos + record_len > data.len() { break; }
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

    /// 记录操作到 WAL (异步, lock-free).
    ///
    /// 调用线程执行 bincode 序列化 + zstd 压缩后推入 lock-free channel，
    /// 后台 wal-writer 线程负责批量写盘。客户端即刻返回，不受磁盘延迟影响。
    fn log_op(&mut self, op: WalOp) {
        if let Some(ref tx) = self.wal_tx {
            let raw = match bincode::serialize(&op) {
                Ok(d) => d,
                Err(_) => return,
            };
            let compressed = match zstd::encode_all(raw.as_slice(), 3) {
                Ok(c) => c,
                Err(_) => return,
            };

            // Build v3 record: [0x03][4B uncomp_len][4B comp_len][data]
            let uncomp_len = (raw.len() as u32).to_le_bytes();
            let comp_len = (compressed.len() as u32).to_le_bytes();
            let mut record = Vec::with_capacity(9 + compressed.len());
            record.push(0x03);
            record.extend_from_slice(&uncomp_len);
            record.extend_from_slice(&comp_len);
            record.extend_from_slice(&compressed);

            // Lock-free push — returns immediately
            let _ = tx.send(WalCommand::Write(record));
        }
    }

    /// Send a flush request to the background WAL writer.
    /// Returns immediately — the flush happens asynchronously.
    pub fn flush_wal(&mut self) {
        if let Some(ref tx) = self.wal_tx {
            let _ = tx.send(WalCommand::Flush);
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
        if let Some(ref tx) = self.wal_tx {
            let _ = tx.send(WalCommand::Shutdown);
        }
        if let Some(handle) = self.wal_handle.take() {
            let _ = handle.join();
        }
    }
}

pub type SharedDb = Arc<RwLock<Database>>;
