#!/usr/bin/env python3
"""
query_data.py — 演示各种查询模式：点查、范围扫描、聚合、GROUP BY。

用法:
    python3 query_data.py
"""

import time
import psycopg2

conn = psycopg2.connect(
    host="127.0.0.1", port=5408,
    user="admin", password="admin123", dbname="huntiandb",
)
conn.autocommit = True
cur = conn.cursor()

queries = [
    ("COUNT(*) 总行数", "SELECT COUNT(*) FROM security_events"),
    ("点查询 WHERE id=5000", "SELECT * FROM security_events WHERE id = 5000"),
    ("范围扫描 BETWEEN", "SELECT * FROM security_events WHERE id BETWEEN 100 AND 200"),
    ("SUM 聚合", "SELECT SUM(status_code) FROM security_events"),
    ("AVG 聚合", "SELECT AVG(status_code) FROM security_events"),
    ("GROUP BY 事件类型", "SELECT event_type, COUNT(*) FROM security_events GROUP BY event_type ORDER BY COUNT(*) DESC"),
    ("TOP 10 最新", "SELECT * FROM security_events ORDER BY timestamp DESC LIMIT 10"),
    ("错误事件筛选", "SELECT * FROM security_events WHERE status_code >= 500 LIMIT 5"),
]

for label, sql in queries:
    t0 = time.perf_counter()
    cur.execute(sql)
    rows = cur.fetchall()
    elapsed = (time.perf_counter() - t0) * 1000
    print(f"\n── {label} ({elapsed:.2f}ms) ──")
    for row in rows[:3]:
        print(f"  {row}")
    if len(rows) > 3:
        print(f"  ... 共 {len(rows)} 行")

cur.close()
conn.close()
print("\n[DONE]")
