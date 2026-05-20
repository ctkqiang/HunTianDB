# User Management

HunTianDB supports role-based user management with SCRAM-SHA-256 authentication.

## Built-in Users

Four users are pre-seeded on first startup:

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | admin |
| `root` | `root123` | admin |
| `writer` | `writer123` | writer |
| `reader` | `reader123` | reader |

## SQL Commands

### SHOW USERS

List all registered users and their roles.

```sql
SHOW USERS;
```

Response:
```
 username | role
-----------+--------
 admin     | admin
 root      | admin
 writer    | writer
 reader    | reader
```

### INSERT INTO users

Standard SQL syntax for creating users. If no password column is specified, defaults to `changeme`.

```sql
INSERT INTO users (username, role) VALUES ('analyst', 'reader');
INSERT INTO users (username, password, role) VALUES ('dba', 'secure789', 'admin');
```

### CREATE USER

Create a new user with password and role using HunTianDB-specific syntax.

```sql
CREATE USER username 'password' role;
```

Examples:

```sql
-- Create an admin user
CREATE USER ttt 'securePass789' admin;

-- Create a read-only user
CREATE USER analyst 'analyst123' reader;

-- Create a writer
CREATE USER ingester 'ingest456' writer;
```

Rules:
- Username is case-insensitive
- Password must be at least 6 characters
- Valid roles: `admin`, `writer`, `reader`

### DROP USER

Remove a user.

```sql
DROP USER username;
```

Example:

```sql
DROP USER ttt;
```

## Authentication

HunTianDB uses SCRAM-SHA-256 for password verification. Passwords are never stored in plaintext — only salted hashes are persisted.

### PostgreSQL Wire Protocol

Connect with any standard PostgreSQL client:

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

Response:
```json
{"token":"eyJ...","role":"admin"}
```

## Roles & Permissions

| Role | SELECT | INSERT | CREATE TABLE | DROP TABLE | User Mgmt |
|------|--------|--------|-------------|------------|-----------|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| writer | ✅ | ✅ | ✅ | ❌ | ❌ |
| reader | ✅ | ❌ | ❌ | ❌ | ❌ |
