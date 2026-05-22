# 混天DB 示例代码

每种语言提供 4 个主题示例，演示混天DB 的核心功能。

## 前置条件

```bash
pip install psycopg2-binary  # Python
cd ../backend && cargo run --release  # 启动混天DB
```

## 语言目录

| 语言 | 目录 | 驱动/库 |
|------|------|--------|
| Python | `python/` | psycopg2 |
| TypeScript | `typescript/` | pg |
| Go | `go/` | lib/pq |
| Rust | `rust/` | psql CLI |
| C | `c/` | libpq |
| Erlang | `erlang/` | epgsql |
| Haskell | `haskell/` | postgresql-simple |
| 仓颉 | `cangjie/` | psql CLI |

## 示例文件（每种语言）

| 文件 | 说明 |
|------|------|
| `create_table.*` | 创建安全审计事件表 + SHOW TABLES |
| `data_insert_totable.*` | 批量插入数据，可配置行数和批大小 |
| `query_data.*` | 查询：COUNT、SUM、AVG、GROUP BY |
| `user_management.*` | 用户管理：SHOW USERS、INSERT/CREATE USER |

## Python 快速开始

```bash
cd python/
python3 create_table.py
python3 data_insert_totable.py 10000 500
python3 query_data.py
python3 user_management.py
```
