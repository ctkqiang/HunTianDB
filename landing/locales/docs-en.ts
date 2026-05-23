import { VERSION} from "../composables/useVersion";
export default {
  title: "Documentation",
  search: "Search docs...",
  sections: [
    {
      id: "getting-started",
      title: "Getting Started",
      items: [
        { id: "overview", title: "Overview", content: `<h2>HunTianDB Overview</h2>
<p>HunTianDB is a high-performance <strong>timeseries security database</strong> written in Rust, with full PostgreSQL Wire Protocol v3.0 compatibility. It is designed for security audit trails, financial event streams, and real-time observability workloads.</p>

<h3>Key Capabilities</h3>
<div class="grid-3">
  <div class="info-card"><strong>PG Wire Compatible</strong><span>Use psql, DBeaver, JDBC, psycopg2, or any standard PostgreSQL client with zero code changes.</span></div>
  <div class="info-card"><strong>Blazing Fast Writes</strong><span>Async lock-free WAL with crossbeam channels. 68K+ INSERT/s on a single Apple Silicon node.</span></div>
  <div class="info-card"><strong>Vectorized Aggregation</strong><span>Columnar cache with contiguous f64 slices. COUNT(*) in 0.07ms on 100K rows — 500x faster than PostgreSQL.</span></div>
  <div class="info-card"><strong>Crash Safe</strong><span>CRC32 WAL checksums, LSN checkpoint recovery, synchronous commit modes. Kill -9 with zero data loss.</span></div>
  <div class="info-card"><strong>DBeaver Compatible</strong><span>Full system catalog query interception. Browse tables, run queries, manage users — all from DBeaver GUI.</span></div>
  <div class="info-card"><strong>Production Metrics</strong><span>Prometheus endpoint with histograms, gauges, and counters. Health check endpoints for orchestration.</span></div>
</div>

<h3>Architecture</h3>
<pre><code>Frontend (React + TDesign + Monaco)     Port 3000
       |
REST API (axum)  +  PG Wire Protocol (tokio)
       \\                    /
      Database Engine (in-memory, WAL persistence)
                |
      data/recovery.log  (zstd-compressed bincode, async writer)
      Prometheus /metrics                 Port 5490</code></pre>` },

        { id: "quickstart", title: "Quick Start", content: `<h2>Quick Start</h2>

<h3>Docker (Recommended)</h3>
<pre><code>docker pull ctkqiang/huntiandb:${VERSION }
docker run -d -p 5408:5408 -p 3000:3000 -p 5490:5490 \\
  -v huntian_data:/app/data \\
  ctkqiang/huntiandb:${VERSION }</code></pre>

<h3>Build from Source</h3>
<pre><code>git clone https://github.com/ctkqiang/HunTianDB
cd HuntianDB/backend
cargo run --release</code></pre>

<h3>Connect</h3>
<pre><code>psql -h localhost -p 5408 -U admin -d huntiandb</code></pre>

<p>Default credentials: <code>admin</code> / <code>admin123</code></p>

<h3>Exposed Ports</h3>
<table><tr><th>Port</th><th>Protocol</th><th>Description</th></tr>
<tr><td>5408</td><td>PostgreSQL Wire</td><td>psql, DBeaver, JDBC, psycopg2</td></tr>
<tr><td>3000</td><td>HTTP</td><td>REST API + Web Portal</td></tr>
<tr><td>5490</td><td>HTTP</td><td>Prometheus /metrics + /health + /ready</td></tr></table>` },

        { id: "configuration", title: "Configuration", content: `<h2>Configuration</h2>
<p>All configuration is done via environment variables.</p>

<table><tr><th>Variable</th><th>Default</th><th>Description</th></tr>
<tr><td>POSTGRES_PORT</td><td>5408</td><td>PG Wire Protocol port</td></tr>
<tr><td>REST_PORT</td><td>3000</td><td>REST API + Portal port</td></tr>
<tr><td>METRICS_PORT</td><td>5490</td><td>Prometheus metrics port (0=disable)</td></tr>
<tr><td>DATA_DIR</td><td>./data</td><td>Data persistence directory</td></tr>
<tr><td>WAL_ENABLED</td><td>true</td><td>Enable WAL persistence</td></tr>
<tr><td>SYNC_COMMIT</td><td>on</td><td>off / on / strict</td></tr>
<tr><td>WAL_CHECKSUM</td><td>true</td><td>CRC32 WAL checksums</td></tr>
<tr><td>CHECKPOINT_INTERVAL_SECS</td><td>300</td><td>Checkpoint interval</td></tr>
<tr><td>SLOW_QUERY_THRESHOLD_MS</td><td>100</td><td>Slow query log threshold</td></tr>
<tr><td>RUST_LOG</td><td>info</td><td>Log level</td></tr>
</table>` },
      ],
    },
    {
      id: "sql-reference",
      title: "SQL Reference",
      items: [
        { id: "ddl", title: "DDL", content: `<h2>Data Definition Language</h2>

<h3>CREATE TABLE</h3>
<pre><code>CREATE TABLE table_name (
  column_name TYPE [NOT NULL],
  ...
);
</code></pre>
<p>Supported types: <code>BIGINT</code>, <code>INT</code>, <code>SMALLINT</code>, <code>VARCHAR(n)</code>, <code>TEXT</code></p>

<h4>Example</h4>
<pre><code>CREATE TABLE events (
  id BIGINT PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  user_id INT,
  event_type SMALLINT,
  zone SMALLINT,
  status_code SMALLINT,
  ip_address INT,
  payload TEXT
);</code></pre>

<h3>DROP TABLE</h3>
<pre><code>DROP TABLE table_name;</code></pre>

<h3>DESCRIBE / SHOW COLUMNS</h3>
<pre><code>DESCRIBE table_name;
SHOW COLUMNS FROM table_name;</code></pre>
<p>Returns: column_name, type, nullable</p>` },

        { id: "dml", title: "DML", content: `<h2>Data Manipulation Language</h2>

<h3>INSERT</h3>
<pre><code>INSERT INTO table_name VALUES (val1, val2, ...);
INSERT INTO table_name VALUES (v1,v2), (v3,v4), ...;</code></pre>
<p>Value count must match column count exactly.</p>

<h3>SELECT</h3>
<pre><code>SELECT * FROM table_name;
SELECT col1, col2 FROM table_name WHERE condition;
SELECT * FROM table_name ORDER BY col DESC LIMIT 100;</code></pre>
<p>Supported: <code>WHERE</code>, <code>LIMIT</code>, <code>ORDER BY</code>, <code>BETWEEN</code></p>` },

        { id: "aggregates", title: "Aggregate Functions", content: `<h2>Aggregate Functions</h2>
<p>All aggregates are computed in-engine using columnar vectorization with contiguous f64 slices.</p>

<h3>COUNT</h3>
<pre><code>SELECT COUNT(*) FROM events;
SELECT COUNT(column) FROM events;</code></pre>

<h3>SUM / AVG</h3>
<pre><code>SELECT SUM(status_code) FROM events;
SELECT AVG(status_code) FROM events;</code></pre>

<h3>MIN / MAX</h3>
<pre><code>SELECT MIN(timestamp) FROM events;
SELECT MAX(timestamp) FROM events;</code></pre>

<h3>GROUP BY</h3>
<pre><code>SELECT event_type, COUNT(*) FROM events GROUP BY event_type;
SELECT zone, AVG(status_code) FROM events GROUP BY zone ORDER BY COUNT(*) DESC;</code></pre>

<h3>Performance</h3>
<table><tr><th>Operation</th><th>100K Rows</th><th>vs PostgreSQL 16</th></tr>
<tr><td>COUNT(*)</td><td>0.07ms</td><td>500x faster</td></tr>
<tr><td>SUM</td><td>5.8ms</td><td>—</td></tr>
<tr><td>AVG</td><td>5.7ms</td><td>—</td></tr>
<tr><td>GROUP BY</td><td>21.9ms</td><td>—</td></tr></table>` },

        { id: "metadata", title: "Metadata Commands", content: `<h2>Metadata Commands</h2>

<h3>SHOW TABLES</h3>
<pre><code>SHOW TABLES;</code></pre>
<p>Returns: table_name, columns, rows</p>

<h3>SHOW USERS</h3>
<pre><code>SHOW USERS;</code></pre>
<p>Returns: username, role</p>

<h3>SHOW / DESCRIBE</h3>
<pre><code>DESCRIBE table_name;
SHOW COLUMNS FROM table_name;</code></pre>` },

        { id: "users", title: "User Management", content: `<h2>User Management</h2>

<h3>Built-in Users</h3>
<table><tr><th>Username</th><th>Password</th><th>Role</th></tr>
<tr><td>admin</td><td>admin123</td><td>admin</td></tr>
<tr><td>root</td><td>root123</td><td>admin</td></tr>
<tr><td>writer</td><td>writer123</td><td>writer</td></tr>
<tr><td>reader</td><td>reader123</td><td>reader</td></tr></table>

<h3>INSERT INTO users</h3>
<pre><code>INSERT INTO users (username, role) VALUES ('analyst', 'reader');
INSERT INTO users (username, password, role) VALUES ('dba', 'secure789', 'admin');</code></pre>

<h3>CREATE USER</h3>
<pre><code>CREATE USER username 'password' role;</code></pre>

<h3>DROP USER</h3>
<pre><code>DROP USER username;</code></pre>

<h3>Roles & Permissions</h3>
<table><tr><th>Role</th><th>SELECT</th><th>INSERT</th><th>DDL</th><th>User Mgmt</th></tr>
<tr><td>admin</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
<tr><td>writer</td><td>Yes</td><td>Yes</td><td>Yes</td><td>No</td></tr>
<tr><td>reader</td><td>Yes</td><td>No</td><td>No</td><td>No</td></tr></table>` },
      ],
    },
    {
      id: "internals",
      title: "Internals",
      items: [
        { id: "wal", title: "WAL & Durability", content: `<h2>Write-Ahead Log (WAL)</h2>

<h3>Format</h3>
<p>WAL records use <strong>v4 format</strong>: <code>[0x04][CRC32 LE][LSN LE][uncomp_len LE][comp_len LE][zstd(bincode WalOp)]</code></p>
<p>Backward-compatible with v1 (JSON), v2 (uncompressed bincode), v3 (zstd w/o CRC).</p>

<h3>Compression</h3>
<table><tr><th>Metric</th><th>v1 JSON</th><th>v4 zstd+CRC</th></tr>
<tr><td>Bytes per row</td><td>~450</td><td>~109</td></tr>
<tr><td>Compression</td><td>None</td><td>5.0x</td></tr>
<tr><td>Checksum</td><td>None</td><td>CRC32</td></tr>
</table>

<h3>Synchronous Commit</h3>
<table><tr><th>Mode</th><th>fsync</th><th>dir sync</th><th>Durability</th></tr>
<tr><td>Off</td><td>No</td><td>No</td><td>OS decides</td></tr>
<tr><td>On</td><td>Yes</td><td>No</td><td>fsync after commit</td></tr>
<tr><td>Strict</td><td>Yes</td><td>Yes</td><td>fsync WAL + parent dir</td></tr></table>

<h3>Async WAL Architecture</h3>
<pre><code>Client thread:  bincode + zstd + CRC32 → push to crossbeam channel → RETURN
BG wal-writer:  receive → BufWriter → fsync every 500 ops</code></pre>

<h3>Crash Recovery</h3>
<ol><li>Read latest checkpoint (checkpoint.bin) → last_lsn, wal_offset</li>
<li>Scan WAL from checkpoint offset</li>
<li>Verify CRC32 of each record</li>
<li>Replay committed records idempotently</li>
<li>Set ready flag → accept queries</li></ol>` },

        { id: "aggregation-engine", title: "Aggregation Engine", content: `<h2>Aggregation Engine</h2>

<h3>Columnar Cache</h3>
<p>On first aggregate call, the engine extracts numeric values from HashMap rows into <strong>contiguous Vec&lt;f64&gt;</strong> slices. Subsequent aggregates iterate the cached flat array — CPU cache-friendly, auto-vectorized by LLVM.</p>

<pre><code>fn sum_fast(&mut self, col: &str) -> f64 {
    self.ensure_col_f64(col).iter().sum()  // &[f64] → SIMD
}</code></pre>

<h3>Cache Invalidation</h3>
<p>The column cache is cleared on every INSERT. It rebuilds lazily on the next aggregate call. This ensures consistency at the cost of 5-6ms rebuild time per 100K rows.</p>

<h3>Perf</h3>
<table><tr><th>Rows</th><th>COUNT(*)</th><th>SUM</th><th>AVG</th></tr>
<tr><td>100K</td><td>0.07ms</td><td>5.8ms</td><td>5.7ms</td></tr>
<tr><td>1M</td><td>0.15ms</td><td>~60ms</td><td>~60ms</td></tr></table>` },

        { id: "wire-protocol", title: "PG Wire Protocol", content: `<h2>PostgreSQL Wire Protocol</h2>

<h3>Supported Messages</h3>
<table><tr><th>Type</th><th>Byte</th><th>Description</th></tr>
<tr><td>Simple Query</td><td>Q</td><td>Standard SQL execution</td></tr>
<tr><td>Parse</td><td>P</td><td>Prepared statement parse</td></tr>
<tr><td>Bind</td><td>B</td><td>Parameter binding</td></tr>
<tr><td>Describe</td><td>D</td><td>Column metadata</td></tr>
<tr><td>Execute</td><td>E</td><td>Execute prepared statement</td></tr>
<tr><td>Sync</td><td>S</td><td>Transaction sync</td></tr>
</table>

<h3>System Catalog Interception</h3>
<p>To support DBeaver/pgAdmin, HunTianDB intercepts PostgreSQL system catalog queries and returns compatible mock responses:</p>

<table><tr><th>Query</th><th>Response</th></tr>
<tr><td>SELECT version()</td><td>PostgreSQL 16.0 (HunTianDB)</td></tr>
<tr><td>SELECT current_schema()</td><td>public</td></tr>
<tr><td>pg_catalog.pg_database</td><td>Database list (huntiandb)</td></tr>
<tr><td>pg_catalog.pg_class</td><td>Table list with schema/type/owner</td></tr>
<tr><td>pg_catalog.pg_settings</td><td>Server settings</td></tr>
<tr><td>pg_catalog.pg_roles</td><td>User/role list</td></tr>
<tr><td>pg_catalog.pg_type</td><td>Data type definitions</td></tr>
</table>` },

        { id: "metrics", title: "Metrics & Observability", content: `<h2>Metrics & Observability</h2>

<h3>Prometheus Endpoint</h3>
<pre><code>GET :5490/metrics   → Prometheus text format
GET :5490/health    → 200 if alive
GET :5490/ready     → 200 if WAL recovery complete</code></pre>

<h3>Exported Metrics</h3>
<table><tr><th>Metric</th><th>Type</th><th>Description</th></tr>
<tr><td>huntian_wal_fsync_seconds</td><td>Histogram</td><td>WAL fsync duration [0.1ms-100ms]</td></tr>
<tr><td>huntian_wal_size_bytes</td><td>Gauge</td><td>Current WAL file size</td></tr>
<tr><td>huntian_wal_replay_lsn</td><td>Gauge</td><td>Last replayed LSN</td></tr>
<tr><td>huntian_memory_usage_bytes</td><td>Gauge</td><td>Process RSS memory</td></tr>
<tr><td>huntian_open_fds</td><td>Gauge</td><td>Open file descriptors</td></tr>
<tr><td>huntian_active_queries</td><td>Gauge</td><td>Currently executing queries</td></tr>
<tr><td>huntian_slow_queries_total</td><td>Counter</td><td>Queries exceeding threshold</td></tr>
<tr><td>huntian_checksum_failures_total</td><td>Counter</td><td>WAL/page checksum failures</td></tr>
<tr><td>huntian_query_duration_seconds</td><td>Histogram</td><td>Query latency [1ms-10s]</td></tr>
<tr><td>huntian_events_written_total</td><td>Counter</td><td>Total rows inserted</td></tr>
</table>

<h3>Slow Query Log</h3>
<p>Queries exceeding <code>SLOW_QUERY_THRESHOLD_MS</code> (default 100ms) are logged to <code>data/slow.log</code>:</p>
<pre><code>[2026-05-21T10:30:00.123Z] 250ms 192.168.1.5 | SELECT * FROM events WHERE status >= 400</code></pre>` },

        { id: "benchmarks", title: "Benchmarks", content: `<h2>Performance Benchmarks</h2>
<p>100,000 rows · Single Node · Apple Silicon macOS · psycopg2 PG Wire Protocol</p>

<h3>INSERT Throughput</h3>
<table><tr><th>Batch Size</th><th>HunTianDB</th><th>PostgreSQL 16</th><th>QuestDB 7.x</th></tr>
<tr><td>50</td><td>61,316 r/s</td><td>3,200 r/s</td><td>41,000 r/s</td></tr>
<tr><td>200</td><td>67,550 r/s</td><td>6,800 r/s</td><td>110,000 r/s</td></tr>
<tr><td>500</td><td>68,139 r/s</td><td>9,500 r/s</td><td>165,000 r/s</td></tr>
<tr><td>1000</td><td>68,972 r/s</td><td>14,000 r/s</td><td>210,000 r/s</td></tr>
<tr><td>5000</td><td>68,741 r/s</td><td>18,000 r/s</td><td>280,000 r/s</td></tr></table>

<h3>Query Latency (p50)</h3>
<table><tr><th>Query</th><th>HunTianDB</th><th>PostgreSQL 16</th><th>QuestDB 7.x</th></tr>
<tr><td>Point Lookup</td><td>0.58ms</td><td>1.2ms</td><td>0.2ms</td></tr>
<tr><td>Range Scan</td><td>0.39ms</td><td>6.0ms</td><td>1.5ms</td></tr>
<tr><td>COUNT(*)</td><td>0.07ms</td><td>35ms</td><td>3.5ms</td></tr>
</table>

<h3>WAL Efficiency</h3>
<table><tr><th>Metric</th><th>v1 JSON</th><th>v4 zstd+CRC</th></tr>
<tr><td>Bytes/row</td><td>450</td><td>109</td></tr>
<tr><td>Compression</td><td>—</td><td>5.0x</td></tr>
</table>` },
      ],
    },
    {
      id: "client-libs",
      title: "Client Libraries",
      items: [
        { id: "clients", title: "Language Examples", content: `<h2>Client Libraries</h2>
<p>Any PostgreSQL-compatible client works. Here are examples for popular languages:</p>

<h3>Python (psycopg2)</h3>
<pre><code>import psycopg2
conn = psycopg2.connect(host="localhost", port=5408, user="admin", password="admin123", dbname="huntiandb")</code></pre>

<h3>Go (lib/pq)</h3>
<pre><code>import "database/sql"
import _ "github.com/lib/pq"
db, _ := sql.Open("postgres", "host=localhost port=5408 user=admin password=admin123 dbname=huntiandb sslmode=disable")</code></pre>

<h3>Rust (tokio-postgres)</h3>
<pre><code>let (client, conn) = tokio_postgres::connect("host=localhost port=5408 user=admin password=admin123 dbname=huntiandb", NoTls).await?;</code></pre>

<h3>Node.js (pg)</h3>
<pre><code>import pg from "pg";
const client = new pg.Client({ host: "localhost", port: 5408, user: "admin", password: "admin123", database: "huntiandb" })</code></pre>

<h3>Java (JDBC)</h3>
<pre><code>String url = "jdbc:postgresql://localhost:5408/huntiandb";
Connection conn = DriverManager.getConnection(url, "admin", "admin123");</code></pre>

<h3>C (libpq)</h3>
<pre><code>PGconn *conn = PQconnectdb("host=localhost port=5408 user=admin password=admin123 dbname=huntiandb");</code></pre>

<h3>psql</h3>
<pre><code>psql -h localhost -p 5408 -U admin -d huntiandb</code></pre>` },
      ],
    },
    {
      id: "examples",
      title: "Examples",
      items: [
        { id: "python-examples", title: "Python (psycopg2)", content: `<h2>Python</h2>
<p>examples/python/ — 4 scripts: create_table, data_insert_totable, query_data, user_management</p>
<pre><code># examples/python/create_table.py
import psycopg2
conn = psycopg2.connect(host="127.0.0.1", port=5408, user="admin", password="admin123", dbname="huntiandb")
conn.autocommit = True; cur = conn.cursor()
cur.execute("CREATE TABLE security_events (id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL, user_id INT, session_id BIGINT, event_type SMALLINT, zone SMALLINT, status_code SMALLINT, ip_address INT, parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT)")
# examples/python/data_insert_totable.py: batch insert with throughput measurement
# examples/python/query_data.py: COUNT, SUM, AVG, GROUP BY
# examples/python/user_management.py: SHOW USERS, INSERT INTO users</code></pre>` },

        { id: "go-examples", title: "Go (lib/pq)", content: `<h2>Go</h2>
<p>examples/go/ — PostgreSQL wire protocol via lib/pq</p>
<pre><code>// examples/go/create_table.go
db, _ := sql.Open("postgres", "host=127.0.0.1 port=5408 user=admin password=admin123 dbname=huntiandb sslmode=disable")
db.Exec("CREATE TABLE security_events (id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL, user_id INT, session_id BIGINT, event_type SMALLINT, zone SMALLINT, status_code SMALLINT, ip_address INT, parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT)")
// examples/go/data_insert_totable.go: fmt.Sprintf batch insert
// examples/go/query_data.go: aggregation queries
// examples/go/user_management.go: INSERT INTO users</code></pre>` },

        { id: "ts-examples", title: "TypeScript (pg)", content: `<h2>TypeScript</h2>
<p>examples/typescript/ — npm install pg</p>
<pre><code>// examples/typescript/create_table.ts
import { Client } from "pg";
const c = new Client({ host: "127.0.0.1", port: 5408, user: "admin", password: "admin123", database: "huntiandb" });
await c.connect();
await c.query("CREATE TABLE security_events (id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL, user_id INT, session_id BIGINT, event_type SMALLINT, zone SMALLINT, status_code SMALLINT, ip_address INT, parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT)");
// examples/typescript/data_insert_totable.ts: array push + join
// examples/typescript/query_data.ts: async queries
// examples/typescript/user_management.ts: SHOW USERS</code></pre>` },

        { id: "rust-examples", title: "Rust (psql CLI)", content: `<h2>Rust</h2>
<p>examples/rust/ — 4 topic scripts using psql via std::process::Command</p>
<pre><code>// examples/rust/create_table.rs
use std::process::Command;
fn exec(sql: &str) { Command::new("psql").args(["-h","127.0.0.1","-p","5408","-U","admin","-d","huntiandb","-c",sql]).env("PGPASSWORD","admin123").output().unwrap(); }
exec("CREATE TABLE security_events (id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL, user_id INT, session_id BIGINT, event_type SMALLINT, zone SMALLINT, status_code SMALLINT, ip_address INT, parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT)");
// examples/rust/data_insert_totable.rs: batch insert with format! macros
// examples/rust/query_data.rs: aggregation queries via psql
// examples/rust/user_management.rs: SHOW USERS, INSERT INTO users</code></pre>` },

        { id: "c-examples", title: "C (libpq)", content: `<h2>C</h2>
<p>examples/c/ — libpq direct connection, gcc compile</p>
<pre><code>// examples/c/create_table.c — gcc -o ct create_table.c -lpq
#include &lt;libpq-fe.h&gt;
PGconn *c = PQconnectdb("host=127.0.0.1 port=5408 user=admin password=admin123 dbname=huntiandb");
PQexec(c, "CREATE TABLE security_events (id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL, user_id INT, session_id BIGINT, event_type SMALLINT, zone SMALLINT, status_code SMALLINT, ip_address INT, parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT)");
// examples/c/data_insert_totable.c: snprintf batch insert
// examples/c/query_data.c: PQexec + PQgetvalue
// examples/c/user_management.c: SHOW USERS via PQexec</code></pre>` },

        { id: "erlang-examples", title: "Erlang (epgsql)", content: `<h2>Erlang</h2>
<p>examples/erlang/ — epgsql PostgreSQL client</p>
<pre><code>%% examples/erlang/create_table.erl
{ok, C} = epgsql:connect("127.0.0.1", "admin", "admin123", [{port, 5408}, {database, "huntiandb"}]).
epgsql:squery(C, "CREATE TABLE security_events (id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL, user_id INT, session_id BIGINT, event_type SMALLINT, zone SMALLINT, status_code SMALLINT, ip_address INT, parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT)").
%% examples/erlang/data_insert_totable.erl: batch_insert with io_lib:format
%% examples/erlang/query_data.erl: equery aggregation
%% examples/erlang/user_management.erl: INSERT INTO users</code></pre>` },

        { id: "haskell-examples", title: "Haskell (postgresql-simple)", content: `<h2>Haskell</h2>
<p>examples/haskell/ — postgresql-simple, runghc</p>
<pre><code>-- examples/haskell/create_table.hs
import Database.PostgreSQL.Simple
conn &lt;- connect defaultConnectInfo { connectHost="127.0.0.1", connectPort=5408, connectUser="admin", connectPassword="admin123", connectDatabase="huntiandb" }
execute_ conn "CREATE TABLE security_events (id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL, user_id INT, session_id BIGINT, event_type SMALLINT, zone SMALLINT, status_code SMALLINT, ip_address INT, parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT)"
-- examples/haskell/data_insert_totable.hs: mapM_ batch insert
-- examples/haskell/query_data.hs: query_ aggregation
-- examples/haskell/user_management.hs: execute_ INSERT INTO users</code></pre>` },

        { id: "cangjie-examples", title: "Cangjie (psql CLI)", content: `<h2>Cangjie</h2>
<p>examples/cangjie/ — psql via Process.run</p>
<pre><code>// examples/cangjie/create_table.cj
import std.io.*
import std.process.*
func exec(sql: String): String {
    return Process.run("psql", ["-h","127.0.0.1","-p","5408","-U","admin","-d","huntiandb","-c",sql], env: ["PGPASSWORD":"admin123"]).stdout
}
exec("CREATE TABLE security_events (id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL, user_id INT, session_id BIGINT, event_type SMALLINT, zone SMALLINT, status_code SMALLINT, ip_address INT, parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT)")
// examples/cangjie/data_insert_totable.cj: for loop batch insert
// examples/cangjie/query_data.cj: aggregation queries
// examples/cangjie/user_management.cj: SHOW USERS</code></pre>` },

      ],
    },
  ],
};