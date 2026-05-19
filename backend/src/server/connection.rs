//! 连接管理
//!
//! 管理客户端连接的生命周期，
//! 包括连接池、超时控制和优雅关闭。

use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;
use chrono::{DateTime, Utc};

/// 单个连接的信息
#[derive(Debug, Clone)]
pub struct ConnectionInfo {
    /// 连接ID（全局唯一）
    pub id: u64,
    /// 客户端地址
    pub peer_addr: String,
    /// 连接建立时间
    pub connected_at: DateTime<Utc>,
    /// 认证用户名
    pub username: Option<String>,
    /// 数据库名
    pub database: Option<String>,
}

/// 连接管理器
///
/// 线程安全（RwLock），支持并发读写。
pub struct ConnectionManager {
    connections: RwLock<HashMap<u64, ConnectionInfo>>,
    next_id: std::sync::atomic::AtomicU64,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: RwLock::new(HashMap::new()),
            next_id: std::sync::atomic::AtomicU64::new(1),
        }
    }

    /// 注册新连接
    pub fn register(&self, peer_addr: String) -> u64 {
        let id = self.next_id.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let info = ConnectionInfo {
            id,
            peer_addr,
            connected_at: Utc::now(),
            username: None,
            database: None,
        };
        self.connections.write().insert(id, info);
        id
    }

    /// 注销连接
    pub fn unregister(&self, id: u64) {
        self.connections.write().remove(&id);
    }

    /// 获取当前活跃连接数
    pub fn active_count(&self) -> usize {
        self.connections.read().len()
    }
}
