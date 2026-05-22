#!/usr/bin/env python3
"""
create_table.py — 在混天DB中创建数据表。

用法:
    python3 create_table.py

前置条件:
    pip install psycopg2-binary
    混天DB运行中: cargo run --release (端口5408)
"""

import psycopg2

# 连接混天DB — 完全兼容 PostgreSQL Wire Protocol
conn = psycopg2.connect(
    host="127.0.0.1",
    port=5408,
    user="admin",
    password="admin123",
    dbname="huntiandb",
)
conn.autocommit = True
cur = conn.cursor()

# 删除旧表（如果存在）
try:
    cur.execute("DROP TABLE security_events")
    print("[OK] 已删除旧表 security_events")
except Exception:
    pass

# 创建安全审计事件表
cur.execute("""
    CREATE TABLE security_events (
        id BIGINT PRIMARY KEY,
        timestamp BIGINT NOT NULL,
        user_id INT,
        session_id BIGINT,
        event_type SMALLINT,
        zone SMALLINT,
        status_code SMALLINT,
        ip_address INT,
        parent_event_id BIGINT,
        error_msg VARCHAR(256),
        payload TEXT
    )
""")
print("[OK] 表 security_events 已创建 (11 列)")

# 验证
cur.execute("SHOW TABLES")
print("\n当前数据表:")
for row in cur.fetchall():
    print(f"  - {row}")

cur.execute("DESCRIBE security_events")
print("\n表结构:")
for row in cur.fetchall():
    print(f"  {row[0]:20s} {row[1]:10s} nullable={row[2]}")

cur.close()
conn.close()
print("\n[DONE]")
