//! 查询引擎模块
//!
//! SQL 解析 → 语义验证 → 执行计划 → 向量化执行。
//! 利用 Apache Arrow 实现 SIMD 加速的列式处理。

pub mod parser;
pub mod validator;
pub mod planner;
pub mod optimizer;
pub mod executor;
