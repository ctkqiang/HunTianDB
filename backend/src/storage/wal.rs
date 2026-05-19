//! Write-Ahead Log (预写日志)
//!
//! 在写入 Parquet 之前，所有事件先写入加密的 WAL，
//! 保证持久性（Durability）。系统崩溃后从 WAL 恢复。
//!
//! WAL 格式（每条记录）:
//! ```text
//! [长度: 4字节][Nonce: 12字节][密文: N字节][认证标签: 16字节]
//! ```
//! 加密算法：AES-256-GCM

use std::fs::{File, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use parking_lot::Mutex;
use crate::error::{HunTianError, HunTianResult};
use crate::models::Event;
use chrono::Utc;

/// 预写日志管理器
///
/// 负责将事件批量写入加密的 WAL 文件。
/// 后台线程定期（每 100ms 或 100K 事件）刷盘。
pub struct WriteAheadLog {
    /// 当前 WAL 文件写入器（BufWriter 缓冲）
    writer: Arc<Mutex<Option<BufWriter<File>>>>,
    /// AES-256-GCM 加密器
    cipher: Aes256Gcm,
    /// 当前 WAL 文件路径
    current_path: PathBuf,
    /// 数据目录
    data_dir: PathBuf,
    /// 全局序列号计数器
    sequence: Arc<std::sync::atomic::AtomicU64>,
    /// 上次刷盘时间
    last_sync: Arc<Mutex<Instant>>,
    /// 刷盘间隔
    sync_interval: Duration,
    /// 未刷盘事件计数
    unsynced_count: Arc<std::sync::atomic::AtomicUsize>,
    /// 批次大小阈值
    batch_size: usize,
}

impl WriteAheadLog {
    /// 创建新的 WAL 实例
    ///
    /// `encryption_key` 必须是 32 字节的 AES-256 密钥。
    /// `data_dir` 是 WAL 文件的存储目录。
    pub fn new(
        encryption_key: &[u8],
        data_dir: PathBuf,
        sync_interval_ms: u64,
        batch_size: usize,
    ) -> HunTianResult<Self> {
        // 初始化 AES-256-GCM
        let key = aes_gcm::Key::<Aes256Gcm>::from_slice(encryption_key);
        let cipher = Aes256Gcm::new(key);

        // 确保数据目录存在
        std::fs::create_dir_all(&data_dir)?;

        // 创建当天的 WAL 文件
        let today = Utc::now().format("%Y-%m-%d").to_string();
        let wal_path = data_dir.join(format!("wal_{}.log.enc", today));

        Ok(Self {
            writer: Arc::new(Mutex::new(None)),
            cipher,
            current_path: wal_path,
            data_dir,
            sequence: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            last_sync: Arc::new(Mutex::new(Instant::now())),
            sync_interval: Duration::from_millis(sync_interval_ms),
            unsynced_count: Arc::new(std::sync::atomic::AtomicUsize::new(0)),
            batch_size,
        })
    }

    /// 追加一批事件到 WAL
    ///
    /// 事件被序列化为 bincode，加密，然后写入 WAL 文件。
    /// 不立即刷盘（由 `maybe_sync` 控制）。
    pub fn append_batch(&self, events: &[Event]) -> HunTianResult<u64> {
        if events.is_empty() {
            return Ok(self.sequence.load(std::sync::atomic::Ordering::SeqCst));
        }

        let mut writer_guard = self.writer.lock();
        if writer_guard.is_none() {
            let file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&self.current_path)?;
            *writer_guard = Some(BufWriter::with_capacity(64 * 1024, file));
        }

        let writer = writer_guard.as_mut().unwrap();
        let mut last_seq = 0;

        for event in events {
            // 分配序列号
            let seq = self.sequence.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            last_seq = seq;

            // 序列化事件
            let plaintext = bincode::serialize(&event)
                .map_err(|e| HunTianError::Internal(format!("序列化失败: {}", e)))?;

            // 生成随机 nonce
            let mut nonce_bytes = [0u8; 12];
            getrandom::getrandom(&mut nonce_bytes)
                .map_err(|e| HunTianError::Internal(format!("随机数生成失败: {}", e)))?;
            let nonce = Nonce::from_slice(&nonce_bytes);

            // AES-256-GCM 加密
            let ciphertext = self.cipher
                .encrypt(nonce, plaintext.as_slice())
                .map_err(|e| HunTianError::Internal(format!("加密失败: {}", e)))?;

            // 写入格式: [长度(4B)][nonce(12B)][密文(N)][tag(16B自动包含)]
            let total_len = ciphertext.len() as u32;
            writer.write_all(&total_len.to_le_bytes())?;
            writer.write_all(&nonce_bytes)?;
            writer.write_all(&ciphertext)?;
        }

        // 检查是否需要刷盘
        let count = self.unsynced_count.fetch_add(events.len(), std::sync::atomic::Ordering::SeqCst);
        if count + events.len() >= self.batch_size {
            drop(writer_guard);
            self.force_sync()?;
        }

        Ok(last_seq)
    }

    /// 检查是否需要刷盘（基于时间间隔）
    pub fn maybe_sync(&self) -> HunTianResult<()> {
        let mut last = self.last_sync.lock();
        if last.elapsed() >= self.sync_interval {
            self.force_sync_internal()?;
            *last = Instant::now();
        }
        Ok(())
    }

    /// 强制刷盘
    pub fn force_sync(&self) -> HunTianResult<()> {
        self.force_sync_internal()
    }

    fn force_sync_internal(&self) -> HunTianResult<()> {
        let mut writer_guard = self.writer.lock();
        if let Some(ref mut writer) = *writer_guard {
            writer.flush()?;
            writer.get_mut().sync_all()?;
        }
        self.unsynced_count.store(0, std::sync::atomic::Ordering::SeqCst);
        Ok(())
    }

    /// 返回当前全局序列号
    pub fn current_sequence(&self) -> u64 {
        self.sequence.load(std::sync::atomic::Ordering::SeqCst)
    }
}

