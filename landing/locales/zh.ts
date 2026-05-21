export default {
  nav: { features: "特性", performance: "性能", quickstart: "快速开始", github: "GitHub", getStarted: "立即开始" },
  hero: {
    badge: "生产就绪 · v0.1.3",
    title1: "为安全而生的", title2: "时序",
    title3: "安全", title4: "数据库",
    desc: "兼容 PostgreSQL Wire Protocol。Rust 打造，极致速度。专为安全审计追踪、金融事件流和实时可观测性设计。",
    copy: "复制", copied: "已复制!",
    tag1: "PG Wire 协议 v3", tag2: "DBeaver 兼容", tag3: "68K INSERT/s", tag4: "Zstd WAL",
  },
  features: {
    heading: "为", headingAccent: "极致性能", headingSuffix: "打造",
    sub: "每一行 Rust 代码都经过精心优化，追求极致的速度、安全和可靠性。",
    items: [
      { title: "PG Wire 协议 v3", desc: "原生 PostgreSQL 线协议。支持 psql、DBeaver、JDBC 及所有标准 PG 客户端，零迁移成本。" },
      { title: "异步无锁 WAL", desc: "写入路径使用 crossbeam 无锁通道。客户端即刻返回，后台线程处理 zstd 压缩与磁盘同步。" },
      { title: "崩溃安全", desc: "CRC32 WAL 校验和、LSN 检查点恢复、同步提交模式。kill -9 重启后数据零丢失。" },
      { title: "向量化聚合", desc: "列式缓存配合连续 f64 切片。10万行 COUNT(*) 仅需 0.07ms — 比 PostgreSQL 快 500 倍。" },
      { title: "SCRAM-SHA-256 认证", desc: "生产级密码验证与加盐哈希。内置管理员、写入者、只读三种角色。" },
      { title: "Docker 单镜像", desc: "一个镜像，三个端口。PG 线协议、REST+Portal、Prometheus 指标，一键拉取运行。" },
    ],
  },
  performance: {
    heading: "基准", headingAccent: "测试", headingSuffix: "结果",
    sub: "100,000 行 · 单节点 · Apple Silicon macOS · psycopg2 PG Wire 协议",
    metrics: [
      { label: "INSERT 吞吐量", value: "68,741 r/s", vs: "PG16 的 1.8 倍" },
      { label: "点查询延迟", value: "0.58ms", vs: "PG16 的 2.1 倍" },
      { label: "COUNT(*) 10万行", value: "0.07ms", vs: "PG16 的 500 倍" },
      { label: "WAL 大小", value: "109 字节", vs: "比 v1 缩小 5 倍" },
    ],
    columns: ["指标", "混天DB", "PostgreSQL 16", "QuestDB 7.x"],
    rows: [
      ["INSERT (batch=5000)", "68,741 r/s", "38,000 r/s", "280,000 r/s"],
      ["点查询 p50", "0.58ms", "1.2ms", "0.2ms"],
      ["COUNT(*) 10万行", "0.07ms", "35ms", "3.5ms"],
      ["DDL CREATE TABLE", "4.0ms", "12ms", "8.0ms"],
      ["WAL 每条记录", "109 字节", "—", "—"],
    ],
  },
  quickstart: {
    heading: "", headingAccent: "秒级", headingSuffix: "启动",
    sub: "单一二进制文件，零依赖，PostgreSQL 兼容。",
    dockerLabel: "Docker",
    cargoLabel: "源码编译",
    psqlLabel: "psql 连接",
    pythonLabel: "Python 连接",
  },
  arch: {
    heading: "系统", headingAccent: "架构", headingSuffix: "",
    diagram: `┌─────────────────────────────────────┐
│  React + TDesign + Monaco          │  ← 前端 (端口 3000)
├─────────────────────────────────────┤
│  Axum REST API  +  PG Wire (tokio)  │  ← 协议层
├──────────────┬──────────────────────┤
│  数据库引擎                          │
│  ├─ 列式缓存 (Vec<f64>)             │  ← 向量化聚合
│  ├─ 异步 WAL (crossbeam 通道)       │  ← 无锁写入
│  ├─ Zstd 压缩 Bincode               │  ← 体积缩小 5 倍
│  ├─ CRC32 校验和                    │  ← 损坏检测
│  ├─ LSN + 检查点                    │  ← 崩溃恢复
│  └─ Prometheus /metrics             │  ← 端口 5490
├─────────────────────────────────────┤
│  data/recovery.log                   │  ← WAL 持久化
└─────────────────────────────────────┘`,
  },
  dockerCode: `# 国际 (Docker Hub)
docker pull ctkqiang/huntiandb:v0.1.3.beta

# 中国 (阿里云容器镜像)
docker pull crpi-onofuhwrkmb5z0mn.cn-hangzhou.personal.cr.aliyuncs.com/nezhawanluoanquan/huntiandb:v0.1.3.beta

# 运行
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
  footer: { license: "MIT 许可证" },
};
