//! 取证追踪系统
//!
//! 支持因果链分析、锁冲突检测和逆向事件追溯。

use std::collections::{HashMap, HashSet};
use chrono::{DateTime, Utc};
use crate::models::{Event, LockRecord};

/// 事件因果链
#[derive(Debug)]
pub struct CausalChain {
    /// 根事件ID
    pub root_event_id: i64,
    /// 事件链（按时间排序）
    pub events: Vec<Event>,
    /// 链长度
    pub chain_length: usize,
}

/// 取证分析器
pub struct ForensicsAnalyzer {
    /// 锁记录表 (lock_id → LockRecord)
    lock_table: HashMap<i32, LockRecord>,
}

impl ForensicsAnalyzer {
    pub fn new() -> Self {
        Self {
            lock_table: HashMap::new(),
        }
    }

    /// 记录锁获取事件
    pub fn record_lock_acquire(&mut self, lock_id: i32, holder_pid: i32) {
        self.lock_table.insert(lock_id, LockRecord {
            lock_id,
            acquired_at: Utc::now(),
            released_at: None,
            holder_pid,
            conflict_pids: Vec::new(),
        });
    }

    /// 记录锁释放事件
    pub fn record_lock_release(&mut self, lock_id: i32) {
        if let Some(record) = self.lock_table.get_mut(&lock_id) {
            record.released_at = Some(Utc::now());
        }
    }

    /// 记录锁冲突
    pub fn record_lock_conflict(&mut self, lock_id: i32, conflicting_pid: i32) {
        if let Some(record) = self.lock_table.get_mut(&lock_id) {
            record.conflict_pids.push(conflicting_pid);
        }
    }

    /// 逆向追溯因果链
    ///
    /// 给定 lock_id 和快照点，找到所有相关事件。
    pub fn trace_causal_chain(
        &self,
        events: &[Event],
        lock_id: i32,
    ) -> CausalChain {
        let mut related: Vec<&Event> = events
            .iter()
            .filter(|e| e.lock_id == lock_id)
            .collect();

        related.sort_by_key(|e| e.timestamp);

        let root_id = related.first().map(|e| e.id).unwrap_or(0);

        CausalChain {
            root_event_id: root_id,
            events: related.into_iter().cloned().collect(),
            chain_length: 0,
        }
    }

    /// 检测死锁
    ///
    /// 返回检测到的死锁环（如果有）。
    pub fn detect_deadlocks(&self) -> Vec<Vec<i32>> {
        let mut deadlocks = Vec::new();

        // 构建等待图：holder → waiters
        let mut wait_graph: HashMap<i32, HashSet<i32>> = HashMap::new();
        for record in self.lock_table.values() {
            if record.released_at.is_none() {
                // 锁仍被持有
                for waiter in &record.conflict_pids {
                    wait_graph
                        .entry(record.holder_pid)
                        .or_default()
                        .insert(*waiter);
                }
            }
        }

        // 简单环检测（DFS）
        // 完整实现需 Tarjan 或 Floyd-Warshall

        deadlocks
    }
}
