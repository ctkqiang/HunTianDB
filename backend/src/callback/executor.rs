//! 回调执行引擎
//!
//! 异步执行已注册的回调函数，支持重试和超时。

use std::sync::Arc;

/// 回调函数类型：接收事件JSON，返回结果
pub type CallbackFn = Arc<dyn Fn(&str) -> Result<(), String> + Send + Sync>;

/// 回调执行器
pub struct CallbackExecutor;

impl CallbackExecutor {
    /// 执行回调，忽略错误（仅记录日志）
    pub async fn execute(callback: &CallbackFn, payload: &str) {
        match callback(payload) {
            Ok(_) => tracing::debug!("回调执行成功"),
            Err(e) => tracing::warn!("回调执行失败: {}", e),
        }
    }

    /// 执行回调并重试（最多3次）
    pub async fn execute_with_retry(callback: &CallbackFn, payload: &str, max_retries: u32) {
        for attempt in 1..=max_retries {
            match callback(payload) {
                Ok(_) => return,
                Err(e) => {
                    if attempt == max_retries {
                        tracing::error!("回调重试{}次后仍失败: {}", max_retries, e);
                    }
                    tokio::time::sleep(std::time::Duration::from_millis(100 * attempt as u64)).await;
                }
            }
        }
    }
}
