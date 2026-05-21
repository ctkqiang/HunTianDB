export default {
  nav: { features: "Features", performance: "Performance", quickstart: "Quick Start", github: "GitHub", getStarted: "Get Started" },
  hero: {
    badge: "Production Ready · v0.1.3",
    title1: "The", title2: "Timeseries",
    title3: "Security", title4: "Database",
    desc: "PostgreSQL wire protocol compatible. Built in Rust for blistering speed. Designed for security audit trails, financial event streams, and real-time observability.",
    copy: "Copy", copied: "Copied!",
    tag1: "PG Wire Protocol v3", tag2: "DBeaver Compatible", tag3: "68K INSERT/s", tag4: "Zstd WAL",
  },
  features: {
    heading: "Engineered for", headingAccent: "Performance",
    sub: "Every line of Rust is optimized for speed, safety, and reliability.",
    items: [
      { title: "PG Wire Protocol v3", desc: "Native PostgreSQL wire protocol. Use psql, DBeaver, JDBC, or any standard PG client. Zero migration cost." },
      { title: "Async Lock-Free WAL", desc: "Write path uses crossbeam channels. Client returns instantly. Background thread handles zstd compression and disk sync." },
      { title: "Crash Safe", desc: "CRC32 WAL checksums, LSN checkpoint recovery, synchronous commit modes. Kill -9 and restart — zero data loss." },
      { title: "Vectorized Aggregation", desc: "Columnar cache with flat f64 slices. COUNT(*) in 0.07ms on 100K rows — 500x faster than PostgreSQL." },
      { title: "SCRAM-SHA-256 Auth", desc: "Production-grade password verification with salted hashes. Built-in admin, writer, reader roles." },
      { title: "Docker Single Binary", desc: "One image, three ports. PG wire, REST+Portal, Prometheus metrics. docker pull and run in seconds." },
    ],
  },
  performance: {
    heading: "Benchmark", headingAccent: "Results",
    sub: "100,000 rows · Single Node · Apple Silicon macOS · psycopg2 PG Wire",
    metrics: [
      { label: "INSERT Throughput", value: "68,741 r/s", vs: "1.8x vs PG16" },
      { label: "Point Lookup", value: "0.58ms", vs: "2.1x vs PG16" },
      { label: "COUNT(*) 100K", value: "0.07ms", vs: "500x vs PG16" },
      { label: "WAL Size", value: "109 bytes", vs: "5x smaller v1" },
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
    heading: "Run in", headingAccent: "Seconds",
    sub: "Single binary. No dependencies. PostgreSQL compatible.",
    dockerLabel: "Docker",
    cargoLabel: "Cargo",
    psqlLabel: "Connect with psql",
    pythonLabel: "Connect with Python",
  },
  arch: {
    heading: "System", headingAccent: "Architecture",
    diagram: `┌─────────────────────────────────────┐
│  React + TDesign + Monaco          │  ← Frontend (Port 3000)
├─────────────────────────────────────┤
│  Axum REST API  +  PG Wire (tokio)  │  ← Protocol Layer
├──────────────┬──────────────────────┤
│  Database Engine                    │
│  ├─ Columnar Cache (Vec<f64>)       │  ← Vectorized Agg
│  ├─ Async WAL (crossbeam channel)   │  ← Lock-free Write
│  ├─ Zstd Compressed Bincode          │  ← 5x Smaller V1
│  ├─ CRC32 Checksums                 │  ← Corruption Detection
│  ├─ LSN + Checkpoint                │  ← Crash Recovery
│  └─ Prometheus /metrics             │  ← Port 5490
├─────────────────────────────────────┤
│  data/recovery.log                   │  ← WAL Persistence
└─────────────────────────────────────┘`,
  },
  dockerCode: `# International (Docker Hub)
docker pull ctkqiang/huntiandb:v0.1.3.beta

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
  footer: { license: "MIT License" },
};
