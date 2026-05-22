#!/usr/bin/env python3
"""
data_insert_totable.py — 向表中批量插入数据。

用法:
    python3 data_insert_totable.py [行数] [批次大小]

示例:
    python3 data_insert_totable.py 10000 500
"""

import sys
import time
import psycopg2

ROWS = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
BATCH = int(sys.argv[2]) if len(sys.argv) > 2 else 500

conn = psycopg2.connect(
    host="127.0.0.1", port=5408,
    user="admin", password="admin123", dbname="huntiandb",
)
conn.autocommit = True
cur = conn.cursor()

# 确保表存在
try:
    cur.execute("""
        CREATE TABLE security_events (
            id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL,
            user_id INT, session_id BIGINT, event_type SMALLINT,
            zone SMALLINT, status_code SMALLINT, ip_address INT,
            parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT
        )
    """)
    print("[OK] 表已创建")
except Exception:
    pass  # already exists

# 批量插入
print(f"\n开始插入 {ROWS:,} 行 (批次={BATCH})...")
PAYLOAD = "SEC_AUDIT_" * 60
t0 = time.perf_counter()
inserted = 0

for b in range(0, ROWS, BATCH):
    vals = []
    end = min(b + BATCH, ROWS)
    for i in range(b, end):
        vals.append(
            f"({i},"
            f"{1779200000000 + i * 1000},"
            f"{i % 500},"
            f"{i * 13},"
            f"{i % 8 + 1},"
            f"{i % 5 + 1},"
            f"{200 if i % 10 != 0 else 500},"
            f"{0x0A000001 + (i % 255)},"
            f"{i - 1 if i > 0 else 0},"
            f"'OK',"
            f"'{PAYLOAD}')"
        )
    cur.execute(f"INSERT INTO security_events VALUES {','.join(vals)}")
    inserted += len(vals)

elapsed = time.perf_counter() - t0
rate = inserted / elapsed if elapsed > 0 else 0

print(f"[OK] 已插入 {inserted:,} 行")
print(f"     耗时: {elapsed:.2f}s")
print(f"     吞吐: {rate:,.0f} 行/秒")

# 验证
cur.execute("SELECT COUNT(*) FROM security_events")
count = cur.fetchone()[0]
print(f"     验证: {count:,} 行 (COUNT(*)={count})")

cur.close()
conn.close()
print("\n[DONE]")
