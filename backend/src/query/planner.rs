//! 执行计划生成器
//!
//! 将已验证的查询转换为可执行的物理计划。

use crate::query::parser::ParsedStatement;

/// 物理执行计划
#[derive(Debug, Clone)]
pub enum ExecutionPlan {
    /// 全表扫描
    Scan {
        partitions: Vec<String>,
    },
    /// 带过滤器的扫描
    FilteredScan {
        partitions: Vec<String>,
        predicate: String,
    },
    /// 聚合操作
    Aggregate {
        input: Box<ExecutionPlan>,
        group_by: Vec<String>,
        aggregates: Vec<String>,
    },
}

pub struct QueryPlanner;

impl QueryPlanner {
    /// 从解析后的语句生成执行计划
    pub fn plan(stmt: &ParsedStatement) -> ExecutionPlan {
        match stmt {
            ParsedStatement::Select { .. } => {
                ExecutionPlan::Scan {
                    partitions: vec![],
                }
            }
            _ => ExecutionPlan::Scan { partitions: vec![] },
        }
    }
}
