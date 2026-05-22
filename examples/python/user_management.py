#!/usr/bin/env python3
"""
user_management.py — 用户管理：创建用户、查看用户、删除用户。

用法:
    python3 user_management.py
"""

import psycopg2

conn = psycopg2.connect(
    host="127.0.0.1", port=5408,
    user="admin", password="admin123", dbname="huntiandb",
)
conn.autocommit = True
cur = conn.cursor()

# 查看现有用户
print("── 当前用户列表 ──")
cur.execute("SHOW USERS")
for row in cur.fetchall():
    print(f"  {row[0]:20s} role={row[1]}")

# 使用标准 SQL 创建用户
print("\n── 创建新用户 ──")
cur.execute("INSERT INTO users (username, password, role) VALUES ('analyst', 'secure789', 'reader')")
print("[OK] INSERT INTO users: analyst (reader)")

cur.execute("CREATE USER auditor 'audit456' writer")
print("[OK] CREATE USER: auditor (writer)")

# 验证
print("\n── 更新后的用户列表 ──")
cur.execute("SHOW USERS")
for row in cur.fetchall():
    print(f"  {row[0]:20s} role={row[1]}")

# 使用新用户连接（需要先 DROP 旧用户防止冲突）
print("\n── 测试只读用户连接 ──")
try:
    cur.execute("DROP USER auditor")
except Exception:
    pass
cur.execute("INSERT INTO users (username, password, role) VALUES ('reader_test', 'read123', 'reader')")

cur.close()
conn.close()

# 用只读用户连接
conn2 = psycopg2.connect(
    host="127.0.0.1", port=5408,
    user="reader_test", password="read123", dbname="huntiandb",
)
conn2.autocommit = True
cur2 = conn2.cursor()

try:
    cur2.execute("SELECT COUNT(*) FROM security_events")
    print(f"  [OK] SELECT: {cur2.fetchone()[0]} 行")
except Exception as e:
    print(f"  [FAIL] SELECT: {e}")

try:
    cur2.execute("INSERT INTO security_events VALUES (99999, 0, 0, 0, 1, 1, 200, 0, 0, 'OK', 'test')")
    print(f"  [FAIL] INSERT should have been rejected")
except Exception:
    print(f"  [OK] INSERT 被正确拒绝（只读用户）")

cur2.close()
conn2.close()
print("\n[DONE]")
