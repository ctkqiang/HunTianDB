# 用户管理

混天DB 支持基于角色的用户管理，使用 SCRAM-SHA-256 认证。

## 内置用户

首次启动时预置四个默认用户：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `admin123` | admin |
| `root` | `root123` | admin |
| `writer` | `writer123` | writer |
| `reader` | `reader123` | reader |

## SQL 命令

### SHOW USERS

列出所有已注册用户及其角色。

```sql
SHOW USERS;
```

响应：
```
 username | role
-----------+--------
 admin     | admin
 root      | admin
 writer    | writer
 reader    | reader
```

### INSERT INTO users

使用标准 SQL 语法创建用户。未指定密码时默认密码为 `changeme`。

```sql
INSERT INTO users (username, role) VALUES ('analyst', 'reader');
INSERT INTO users (username, password, role) VALUES ('dba', 'secure789', 'admin');
```

### CREATE USER

使用混天DB 特有语法创建用户，指定密码与角色。

```sql
CREATE USER 用户名 '密码' 角色;
```

示例：

```sql
-- 创建管理员
CREATE USER ttt 'securePass789' admin;

-- 创建只读用户
CREATE USER analyst 'analyst123' reader;

-- 创建写入者
CREATE USER ingester 'ingest456' writer;
```

规则：
- 用户名不区分大小写
- 密码至少 6 个字符
- 有效角色：`admin`、`writer`、`reader`

### DROP USER

删除用户。

```sql
DROP USER 用户名;
```

示例：

```sql
DROP USER ttt;
```

## 认证

混天DB 使用 SCRAM-SHA-256 进行密码验证。密码不以明文存储 -- 仅持久化加盐哈希值。

### PostgreSQL Wire Protocol

使用任意标准 PostgreSQL 客户端连接：

```bash
psql -h 127.0.0.1 -p 5408 -U ttt -d huntiandb
```

```python
import psycopg2
conn = psycopg2.connect(
    host="127.0.0.1",
    port=5408,
    user="ttt",
    password="securePass789",
    dbname="huntiandb",
)
```

### REST API

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ttt","password":"securePass789"}'
```

响应：
```json
{"token":"eyJ...","role":"admin"}
```

## 角色与权限

| 角色 | SELECT | INSERT | CREATE TABLE | DROP TABLE | 用户管理 |
|------|--------|--------|-------------|------------|----------|
| admin | 允许 | 允许 | 允许 | 允许 | 允许 |
| writer | 允许 | 允许 | 允许 | 禁止 | 禁止 |
| reader | 允许 | 禁止 | 禁止 | 禁止 | 禁止 |
