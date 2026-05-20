# HunTianDB

Timeseries security database with PostgreSQL wire protocol compatibility.

## Quick Start

```bash
cd backend && cargo run --release
```

The database starts on two ports:
- **TCP 5408** -- PostgreSQL Wire Protocol v3.0 (connect with `psql`, `psycopg2`, JDBC, DBeaver)
- **TCP 3000** -- REST API + Frontend dashboard

## Connect

```bash
# psql
psql -h 127.0.0.1 -p 5408 -U admin -d huntiandb

# Python
import psycopg2
conn = psycopg2.connect(host="127.0.0.1", port=5408, user="admin", password="admin123", dbname="huntiandb")
```

Default credentials: `admin` / `admin123`

## SQL Support

| Category | Commands |
|----------|----------|
| DDL | `CREATE TABLE`, `DROP TABLE`, `DESCRIBE` |
| DML | `INSERT INTO`, `SELECT` (WHERE, LIMIT, ORDER BY) |
| Aggregate | `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `GROUP BY` |
| Metadata | `SHOW TABLES`, `SHOW USERS`, `SHOW COLUMNS FROM` |
| Users | `CREATE USER`, `DROP USER`, `INSERT INTO users` |

## User Management

```sql
-- Standard SQL syntax
INSERT INTO users (username, role) VALUES ('analyst', 'reader');

-- Or use built-in commands
CREATE USER analyst 'securePass789' reader;
DROP USER analyst;
SHOW USERS;
```

Roles: `admin`, `writer`, `reader`. See [User Management](docs/en/USER_MANAGEMENT.md) for details.

## Performance

Benchmark numbers from [bench_1779259126.md](benchmark/reports/bench_1779259126.md) -- 100,000 rows, single-node Apple Silicon macOS, psycopg2 PG wire protocol:

| Metric | HunTianDB | PostgreSQL 16 | QuestDB 7.x |
|--------|----------:|-------------:|------------:|
| INSERT (batch=5000) | 68,741 r/s | 38,000 r/s | 280,000 r/s |
| Point lookup p50 | 0.58ms | 1.2ms | 0.2ms |
| COUNT(*) 100K rows | 0.07ms | 35ms | 3.5ms |
| DDL CREATE TABLE | 4.0ms | 12ms | 8.0ms |
| WAL per row | 109 bytes | -- | -- |

**Architecture notes from the benchmark:**
- Write path uses async lock-free WAL (crossbeam channel + background writer thread)
- WAL format: zstd-compressed bincode (v3), 5x smaller than JSON text
- Aggregations are vectorized via columnar cache (flat `f64` slices)
- PG wire protocol allows zero-friction integration with existing PostgreSQL tooling

## Architecture

```
Frontend (React + TDesign + Monaco Editor)
    |
REST API (axum)  +  PG Wire Protocol (tokio)
    \                    /
     Database Engine (in-memory, WAL persistence)
         |
    data/recovery.log  (zstd-compressed bincode, async writer)
```

## Frontend

```bash
cd frontend && bun install && bun run dev
```

Opens on `http://localhost:3000` with:
- **Dashboard** -- real-time security event monitoring with throughput charts and event stream
- **SQL Query Builder** -- multi-tab Monaco editor with table browser, query history, and sample queries
- **Event Viewer** -- paginated security event table with filters
- **Settings** -- system info and configuration

## License

MIT
