export default {
  nav: { features: "Features", performance: "Performance", quickstart: "Quick Start", docs: "Docs", github: "GitHub", gitcode: "GitCode", getStarted: "Get Started" },
  lang: { en: "English", zh: "中文" },
  hero: {
    badge: "Production Ready · v0.1.3",
    line1: "The Timeseries",
    line2: "Security Database",
    desc: "PostgreSQL wire protocol compatible. Built in Rust for blistering speed. Designed for security audit trails, financial event streams, and real-time observability.",
    copy: "Copy", copied: "Copied!",
    tags: ["PG Wire Protocol v3", "DBeaver Compatible", "68K INSERT/s", "Zstd WAL"],
  },
  features: {
    heading: "Engineered for Performance",
    sub: "Every line of Rust is optimized for speed, safety, and reliability.",
    items: [
      { title: "PG Wire Protocol v3", desc: "Native PostgreSQL wire protocol. Use psql, DBeaver, JDBC, or any standard PG client with zero migration cost." },
      { title: "Async Lock-Free WAL", desc: "Write path uses crossbeam channels. Client returns instantly while a background thread handles zstd compression and disk sync." },
      { title: "Crash Safe", desc: "CRC32 WAL checksums, LSN checkpoint recovery, and synchronous commit modes. Kill -9 and restart with zero data loss." },
      { title: "Vectorized Aggregation", desc: "Columnar cache with contiguous f64 slices. COUNT(*) in 0.07ms on 100K rows, 500x faster than PostgreSQL." },
      { title: "SCRAM-SHA-256 Auth", desc: "Production-grade password verification with salted hashes. Built-in admin, writer, and reader roles." },
      { title: "Docker Single Binary", desc: "One image, three ports. PG wire, REST+Portal, and Prometheus metrics. Pull and run in seconds." },
    ],
  },
  performance: {
    heading: "Benchmark Results",
    sub: "100,000 rows · Single Node · Apple Silicon macOS · psycopg2 PG Wire Protocol",
    metrics: [
      { label: "INSERT Throughput", value: "68,741 r/s", vs: "1.8x vs PostgreSQL 16" },
      { label: "Point Lookup p50", value: "0.58ms", vs: "2.1x vs PostgreSQL 16" },
      { label: "COUNT(*) 100K Rows", value: "0.07ms", vs: "500x vs PostgreSQL 16" },
      { label: "WAL per Row", value: "109 bytes", vs: "5x smaller than v1 JSON" },
    ],
    columns: ["Metric", "HunTianDB", "PostgreSQL 16", "QuestDB 7.x"],
    rows: [
      ["INSERT (batch=5000)", "68,741 r/s", "38,000 r/s", "280,000 r/s"],
      ["Point Lookup p50", "0.58ms", "1.2ms", "0.2ms"],
      ["COUNT(*) 100K rows", "0.07ms", "35ms", "3.5ms"],
      ["DDL CREATE TABLE", "4.0ms", "12ms", "8.0ms"],
      ["WAL per row", "109 bytes", "—", "—"],
    ],
  },
  quickstart: {
    heading: "Run in Seconds",
    sub: "Single binary. Zero dependencies. PostgreSQL compatible.",
    step1: { title: "Pull the Image", desc: "Choose your region and pull the container image." },
    step2: { title: "Run the Container", desc: "Start with three exposed ports." },
    step3: { title: "Connect & Query", desc: "PostgreSQL wire protocol means ANY pg client works. Pick your language." },
    clients: [
      { label: "Python", lang: "python", code: `import psycopg2\nconn = psycopg2.connect(\n  host="localhost", port=5408,\n  user="admin", password="admin123",\n  dbname="huntiandb")\ncur = conn.cursor()\ncur.execute("SELECT COUNT(*) FROM events")` },
      { label: "Go", lang: "go", code: `import (\n  "database/sql"\n  _ "github.com/lib/pq"\n)\ndb, _ := sql.Open("postgres",\n  "host=localhost port=5408 user=admin password=admin123 dbname=huntiandb sslmode=disable")\ndb.Query("SELECT COUNT(*) FROM events")` },
      { label: "Java / JDBC", lang: "java", code: `String url = "jdbc:postgresql://localhost:5408/huntiandb";\nConnection conn = DriverManager.getConnection(url, "admin", "admin123");\nStatement stmt = conn.createStatement();\nResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM events");` },
      { label: "Node.js", lang: "javascript", code: `import pg from "pg";\nconst client = new pg.Client({\n  host: "localhost", port: 5408,\n  user: "admin", password: "admin123",\n  database: "huntiandb" })\nawait client.connect()\nconst res = await client.query("SELECT COUNT(*) FROM events")` },
      { label: "Rust", lang: "rust", code: `use tokio_postgres::NoTls;\nlet (client, conn) = tokio_postgres::connect(\n  "host=localhost port=5408 user=admin password=admin123 dbname=huntiandb", NoTls).await?;\nlet rows = client.query("SELECT COUNT(*) FROM events", &[]).await?;` },
      { label: "C / libpq", lang: "c", code: `PGconn *conn = PQconnectdb("host=localhost port=5408 user=admin password=admin123 dbname=huntiandb");\nPGresult *res = PQexec(conn, "SELECT COUNT(*) FROM events");\nprintf("%s", PQgetvalue(res, 0, 0));` },
      { label: "Erlang", lang: "erlang", code: `{ok, C} = epgsql:connect("localhost", "admin", "admin123", [{port, 5408}, {database, "huntiandb"}]).\n{ok, _, Rows} = epgsql:squery(C, "SELECT COUNT(*) FROM events;").` },
      { label: "Haskell", lang: "haskell", code: `import Database.PostgreSQL.Simple\nconn <- connect defaultConnectInfo {\n  connectHost = "localhost", connectPort = 5408,\n  connectUser = "admin", connectPassword = "admin123",\n  connectDatabase = "huntiandb" }\n[Only count] <- query_ conn "SELECT COUNT(*) FROM events"` },
      { label: "PHP", lang: "php", code: `$conn = pg_connect("host=localhost port=5408 user=admin password=admin123 dbname=huntiandb");\n$result = pg_query($conn, "SELECT COUNT(*) FROM events");\n$row = pg_fetch_row($result);` },
      { label: "Ruby", lang: "ruby", code: `require "pg"\nconn = PG.connect(host: "localhost", port: 5408, user: "admin", password: "admin123", dbname: "huntiandb")\nresult = conn.exec("SELECT COUNT(*) FROM events")` },
      { label: "psql", lang: "bash", code: `psql -h localhost -p 5408 -U admin -d huntiandb\nSELECT COUNT(*) FROM events;\nSHOW TABLES;` },
    ],
    dockerHub: "Docker Hub (International)",
    alibaba: "Alibaba Cloud (China)",
    cargo: "Build from Source",
    psql: "Connect with psql",
    python: "Connect with Python",
  },
  arch: {
    heading: "System Architecture",
    layers: [
      { name: "Frontend · Port 3000", tech: "React + TDesign + Monaco Editor", color: "accent" },
      { name: "Protocol Layer", tech: "Axum REST API + PG Wire Protocol (tokio)", color: "gold" },
      { name: "Database Engine", tech: "Columnar Cache · Async WAL · Zstd · CRC32 · LSN · Prometheus", color: "teal" },
      { name: "WAL Persistence", tech: "data/recovery.log · Zstd-compressed Bincode", color: "dim" },
    ],
  },
  dockerCode: `# International (Docker Hub)
docker pull ctkqiang/huntianandb:v0.1.3.beta

# China (Alibaba Cloud)
docker pull crpi-onofuhwrkmb5z0mn.cn-hangzhou.personal.cr.aliyuncs.com/nezhawanluoanquan/huntiandb:v0.1.3.beta

# Run
docker run -d -p 5408:5408 -p 3000:3000 -p 5490:5490 \\
  -v huntian_data:/app/data \\
  ctkqiang/huntiandb:v0.1.3.beta`,
  cargoCode: `git clone https://github.com/ctkqiang/HunTianDB
cd HuntianDB/backend
cargo run --release`,
  psqlCode: `psql -h localhost -p 5408 -U admin -d huntiandb

SELECT event_type, COUNT(*) FROM events GROUP BY event_type;
SHOW TABLES;
SELECT * FROM events WHERE status_code >= 400 LIMIT 10;`,
  pythonCode: `import psycopg2
conn = psycopg2.connect(
    host="localhost", port=5408,
    user="admin", password="admin123",
    dbname="huntiandb"
)
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM events")
print(cur.fetchone())  # ('1000',)`,
  changelog: {
    heading: "Changelog",
    releases: [
      { version: "v0.1.3", date: "2026-05-20", changes: ["Native DBeaver/pgAdmin compatibility via system catalog query interceptor", "Extended protocol support with proper Describe/Execute message handling", "Async lock-free WAL with crossbeam channel + background writer thread", "Columnar aggregation cache with vectorized f64 slice iteration", "SHOW USERS and INSERT INTO users support", "Multi-tab Monaco SQL editor in Web Portal"] },
      { version: "v0.1.2", date: "2026-05-19", changes: ["Docker single-image deployment with multi-stage build", "Frontend + backend merged into single binary serving static files", "Production Prometheus metrics: histograms, gauges, counters", "Health check endpoints: /health, /ready", "CRC32 WAL checksums + LSN checkpoint recovery framework", "Slow query log with configurable threshold"] },
      { version: "v0.1.1", date: "2026-05-18", changes: ["Zstd-compressed bincode WAL format (v3), 5x smaller than JSON", "Cross-vendor benchmark suite (MySQL, PostgreSQL, QuestDB, ClickHouse)", "Web Portal dashboard with real-time event monitoring", "SQL Query Builder with table browser and query history", "Chinese/English internationalization", "SCRAM-SHA-256 authentication with role-based access"] },
      { version: "v0.1.0", date: "2026-05-15", changes: ["Initial release: PostgreSQL Wire Protocol v3.0", "In-memory database engine with WAL persistence", "SQL support: CREATE TABLE, INSERT, SELECT, aggregates", "REST API with JSON query interface", "DBeaver connection compatibility"] },
    ],
  },
  footer: {
    tagline: "Timeseries Security Database · PostgreSQL Wire Protocol Compatible",
    links: "Links",
    author: "Author",
    authorName: "ctkqiang",
    wechat: "WeChat",
    license: "MIT License",
  },
};
