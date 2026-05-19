//! 查询语义验证器
//!
//! 验证 SQL 语义的正确性（表存在性、列类型等）。

use crate::error::HunTianResult;
use crate::query::parser::ParsedStatement;

pub struct QueryValidator;

impl QueryValidator {
    /// 验证解析后的语句是否合法
    pub fn validate(stmt: &ParsedStatement) -> HunTianResult<()> {
        match stmt {
            ParsedStatement::Insert { table, .. } => {
                if table != "events" {
                    return Err(crate::error::HunTianError::Query(
                        format!("未知表: {}，仅支持 events", table)
                    ));
                }
            }
            ParsedStatement::Select { table, .. } => {
                if table != "events" {
                    return Err(crate::error::HunTianError::Query(
                        format!("未知表: {}，仅支持 events", table)
                    ));
                }
            }
            _ => {}
        }
        Ok(())
    }
}
