//! SQL 解析器
//!
//! 基于 `sqlparser` 库解析 SQL 语句，
//! 转换为 HunTianDB 内部查询表示（AST）。

use sqlparser::dialect::GenericDialect;
use sqlparser::parser::Parser;
use sqlparser::ast::{Statement, SetExpr};
use crate::error::{HunTianError, HunTianResult};

#[derive(Debug, Clone)]
pub enum ParsedStatement {
    Insert { table: String, columns: Vec<String>, values: Vec<Vec<String>> },
    Select { columns: Vec<String>, table: String, where_clause: Option<String>, limit: Option<u64> },
    Begin,
    Commit,
    Rollback,
}

pub struct SqlParser {
    dialect: GenericDialect,
}

impl SqlParser {
    pub fn new() -> Self {
        Self { dialect: GenericDialect {} }
    }

    pub fn parse(&self, sql: &str) -> HunTianResult<Vec<ParsedStatement>> {
        let ast = Parser::parse_sql(&self.dialect, sql)
            .map_err(|e| HunTianError::Query(format!("SQL解析: {}", e)))?;

        let mut statements = Vec::new();
        for stmt in ast {
            match stmt {
                Statement::Insert(insert) => {
                    statements.push(ParsedStatement::Insert {
                        table: insert.table_name.to_string(),
                        columns: insert.columns.iter().map(|c| c.to_string()).collect(),
                        values: vec![],
                    });
                }
                Statement::Query(_) => {
                    statements.push(ParsedStatement::Select {
                        columns: vec![],
                        table: "events".into(),
                        where_clause: None,
                        limit: None,
                    });
                }
                Statement::StartTransaction { .. } => {
                    statements.push(ParsedStatement::Begin);
                }
                Statement::Commit { .. } => {
                    statements.push(ParsedStatement::Commit);
                }
                Statement::Rollback { .. } => {
                    statements.push(ParsedStatement::Rollback);
                }
                _ => {}
            }
        }
        Ok(statements)
    }
}
