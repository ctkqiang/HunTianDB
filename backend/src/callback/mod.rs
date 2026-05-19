//! 回调系统模块
//!
//! 允许注册自定义回调函数，
//! 在特定事件（写入完成、快照创建等）时触发。

pub mod executor;
pub mod registry;
