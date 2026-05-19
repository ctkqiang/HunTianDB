//! SQL 解析器
//!
//! 基于 `sqlparser` 库解析 SQL 语句，
//! 转换为 HunTianDB 内部查询表示（AST）。

use sqlparser::dialect::GenericDialect;
use sqlparser::parser::Parser;
use crate::error::{HunTianError, HunTianResult};

/// 支持的 SQL 语句类型
#[derive(Debug, Clone)]
pub enum ParsedStatement {
    /// INSERT INTO events (...) VALUES (...)
    Insert {
        table: String,
        columns: Vec<String>,
        values: Vec<Vec<String>>,
    },
    /// SELECT ... FROM events WHERE ...
    Select {
        columns: Vec<String>,
        table: String,
        where_clause: Option<String>,
        limit: Option<u64>,
    },
    /// BEGIN — 事务开始
    Begin,
    /// COMMIT — 事务提交
    Commit,
    /// ROLLBACK — 事务回滚
    Rollback,
}

/// SQL 解析器
pub struct SqlParser {
    dialect: GenericDialect,
}

impl SqlParser {
    pub fn new() -> Self {
        Self {
            dialect: GenericDialect {},
        }
    }

    /// 解析 SQL 字符串
    pub fn parse(&self, sql: &str) -> HunTianResult<Vec<ParsedStatement>> {
        let ast = Parser::parse_sql(&self.dialect, sql)
            .map_err(|e| HunTianError::Query(format!("SQL 解析错误: {}", e)))?;

        let mut statements = Vec::new();
        for stmt in ast {
            match stmt {
                sqlparser::ast::Statement::Insert { table_name, columns, source, .. } => {
                    statements.push(ParsedStatement::Insert {
                        table: table_name.to_string(),
                        columns: columns.iter().map(|c| c.to_string()).collect(),
                        values: vec![], // 简化处理
                    });
                }
                sqlparser::ast::Statement::Query(query) => {
                    statements.push(ParsedStatement::Select {
                        columns: vec![],
                        table: "events".into(),
                        where_clause: None,
                        limit: None,
                    });
                }
                _ => {}
            }
        }

        Ok(statements)
    }
}
