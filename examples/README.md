# 混天DB 示例代码

Python 示例演示混天DB 的核心功能。所有示例使用标准 PostgreSQL 客户端 `psycopg2`。

## 前置条件

```bash
pip install psycopg2-binary

# 启动混天DB
cd ../backend && cargo run --release
```

## 示例列表

| 文件 | 说明 | 用法 |
|------|------|------|
| `create_table.py` | 创建安全审计事件表 | `python3 create_table.py` |
| `data_insert_totable.py` | 批量插入数据 | `python3 data_insert_totable.py [行数] [批次]` |
| `query_data.py` | 查询：点查、聚合、GROUP BY | `python3 query_data.py` |
| `user_management.py` | 用户管理：创建/查看/删除 | `python3 user_management.py` |

## 运行顺序（推荐）

```bash
python3 create_table.py
python3 data_insert_totable.py 10000 500
python3 query_data.py
python3 user_management.py
```
