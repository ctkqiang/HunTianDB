import { VERSION, BETA_TAG } from "../composables/useVersion";
export default {
  nav: { features: "特性", performance: "性能", quickstart: "快速开始", docs: "文档", github: "GitHub", gitcode: "GitCode", getStarted: "立即开始" },
  lang: { en: "English", zh: "中文" },
  hero: {
    badge: `生产就绪 · ${VERSION}`,
    line1: "为安全而生的",
    line2: "时序数据库",
    desc: "兼容 PostgreSQL Wire Protocol。Rust 打造，极致速度。专为安全审计追踪、金融事件流和实时可观测性设计。",
    copy: "复制", copied: "已复制!",
    tags: ["PG Wire 协议 v3", "DBeaver 兼容", "68K INSERT/s", "Zstd WAL"],
  },
  features: {
    heading: "为极致性能打造",
    sub: "每一行 Rust 代码都经过精心优化，追求极致的速度、安全和可靠性。",
    items: [
      { title: "PG Wire 协议 v3", desc: "原生 PostgreSQL 线协议。支持 psql、DBeaver、JDBC 及所有标准 PG 客户端，零迁移成本。" },
      { title: "异步无锁 WAL", desc: "写入路径使用 crossbeam 无锁通道。客户端即刻返回，后台线程处理 zstd 压缩与磁盘同步。" },
      { title: "崩溃安全", desc: "CRC32 WAL 校验和、LSN 检查点恢复、同步提交模式。kill -9 重启后数据零丢失。" },
      { title: "向量化聚合", desc: "列式缓存配合连续 f64 切片。10 万行 COUNT(*) 仅需 0.07ms，比 PostgreSQL 快 500 倍。" },
      { title: "SCRAM-SHA-256 认证", desc: "生产级密码验证与加盐哈希。内置管理员、写入者、只读三种角色。" },
      { title: "Docker 单镜像", desc: "一个镜像，三个端口。PG 线协议、REST+Portal、Prometheus 指标，一键拉取运行。" },
    ],
  },
  performance: {
    heading: "基准测试结果",
    sub: "100,000 行 · 单节点 · Apple Silicon macOS · psycopg2 PG Wire 协议",
    metrics: [
      { label: "INSERT 吞吐量", value: "68,741 r/s", vs: "PostgreSQL 16 的 1.8 倍" },
      { label: "点查询延迟 p50", value: "0.58ms", vs: "PostgreSQL 16 的 2.1 倍" },
      { label: "COUNT(*) 10 万行", value: "0.07ms", vs: "PostgreSQL 16 的 500 倍" },
      { label: "WAL 每条记录", value: "109 字节", vs: "比 JSON 格式缩小 5 倍" },
    ],
    columns: ["指标", "混天DB", "PostgreSQL 16", "QuestDB 7.x"],
    rows: [
      ["INSERT (batch=5000)", "68,741 r/s", "38,000 r/s", "280,000 r/s"],
      ["点查询 p50", "0.58ms", "1.2ms", "0.2ms"],
      ["COUNT(*) 10 万行", "0.07ms", "35ms", "3.5ms"],
      ["DDL CREATE TABLE", "4.0ms", "12ms", "8.0ms"],
      ["WAL 每条记录", "109 字节", "—", "—"],
    ],
  },
  quickstart: {
    heading: "三步启动",
    sub: "单一二进制文件，零依赖，PostgreSQL 兼容。",
    step1: { title: "拉取镜像", desc: "选择你的地区，拉取容器镜像。" },
    step2: { title: "运行容器", desc: "启动并暴露三个端口。" },
    step3: { title: "连接并查询", desc: "PostgreSQL 线协议意味着任意 PG 客户端都能用。选择你的语言。" },
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
    dockerHub: "Docker Hub（国际）",
    alibaba: "阿里云容器镜像（中国）",
    cargo: "从源码编译",
    psql: "psql 连接",
    python: "Python 连接",
  },
  arch: {
    heading: "系统架构",
    layers: [
      { name: "前端 · 端口 3000", tech: "React + TDesign + Monaco 编辑器", color: "accent" },
      { name: "协议层", tech: "Axum REST API + PG Wire 协议 (tokio)", color: "gold" },
      { name: "数据库引擎", tech: "列式缓存 · 异步 WAL · Zstd · CRC32 · LSN · Prometheus", color: "teal" },
      { name: "WAL 持久化", tech: "data/recovery.log · Zstd 压缩 Bincode", color: "dim" },
    ],
  },
  dockerCode: `# 国际 (Docker Hub)
docker pull ctkqiang/huntiandb:${BETA_TAG}

# 中国 (阿里云容器镜像)
docker pull crpi-onofuhwrkmb5z0mn.cn-hangzhou.personal.cr.aliyuncs.com/nezhawanluoanquan/huntiandb:${BETA_TAG}

# 运行
docker run -d -p 5408:5408 -p 3000:3000 -p 5490:5490 \\
  -v huntian_data:/app/data \\
  ctkqiang/huntiandb:${BETA_TAG}`,
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
    heading: "版本更新",
    releases: [
      { version: "v0.1.3", date: "2026-05-20", changes: ["原生 DBeaver/pgAdmin 兼容：系统目录查询拦截器", "扩展协议支持：Describe/Execute 消息正确处理", "异步无锁 WAL：crossbeam channel + 后台写入线程", "列式聚合缓存：向量化 f64 切片迭代", "SHOW USERS 与 INSERT INTO users 支持", "Web Portal 多标签页 Monaco SQL 编辑器"] },
      { version: "v0.1.2", date: "2026-05-19", changes: ["Docker 单镜像部署：多阶段构建", "前后端合并为单二进制服务静态文件", "生产级 Prometheus 指标：直方图、仪表、计数器", "健康检查端点：/health、/ready", "CRC32 WAL 校验和 + LSN 检查点恢复框架", "慢查询日志：可配置阈值"] },
      { version: "v0.1.1", date: "2026-05-18", changes: ["Zstd 压缩 Bincode WAL 格式 (v3)，比 JSON 小 5 倍", "跨厂商基准测试套件 (MySQL, PostgreSQL, QuestDB, ClickHouse)", "Web Portal 仪表板：实时事件监控", "SQL 查询构建器：数据表浏览器与查询历史", "中英文国际化", "SCRAM-SHA-256 认证：基于角色的访问控制"] },
      { version: "v0.1.0", date: "2026-05-15", changes: ["首次发布：PostgreSQL Wire Protocol v3.0", "内存数据库引擎 + WAL 持久化", "SQL 支持：CREATE TABLE, INSERT, SELECT, 聚合函数", "REST API：JSON 查询接口", "DBeaver 连接兼容"] },
    ],
  },
  footer: {
    tagline: "时序安全数据库 · 兼容 PostgreSQL Wire Protocol",
    links: "链接",
    author: "作者",
    authorName: "ctkqiang",
    wechat: "微信",
    license: "MIT 许可证",
  },
};
