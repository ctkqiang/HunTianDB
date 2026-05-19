//! 回调注册表
//!
//! 注册和管理自定义回调函数。

use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;
use crate::callback::executor::CallbackFn;

/// 回调注册表
pub struct CallbackRegistry {
    callbacks: RwLock<HashMap<String, Vec<CallbackFn>>>,
}

impl CallbackRegistry {
    pub fn new() -> Self {
        Self {
            callbacks: RwLock::new(HashMap::new()),
        }
    }

    /// 注册回调
    ///
    /// `event_type` — 触发回调的事件类型（如 "write_complete", "snapshot_created"）。
    pub fn register(&self, event_type: &str, callback: CallbackFn) {
        self.callbacks
            .write()
            .entry(event_type.to_string())
            .or_default()
            .push(callback);
    }

    /// 获取指定事件类型的所有回调
    pub fn get(&self, event_type: &str) -> Vec<CallbackFn> {
        self.callbacks
            .read()
            .get(event_type)
            .cloned()
            .unwrap_or_default()
    }
}
