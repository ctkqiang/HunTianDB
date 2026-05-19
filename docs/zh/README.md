# 混天DB (HunTianDB) — 时序安全数据库

**混天**是一款面向安全审计日志与金融数据的不可变时序数据库。支持 100万事件/秒的写入吞吐，兼容 PostgreSQL 线协议，内置 TLS 1.3 + AES-256-GCM 企业级加密。

## 核心特性

| 特性 | 说明 |
|------|------|
| 高性能写入 | 1M events/sec 持续吞吐（无锁环形缓冲区） |
| 不可变存储 | 仅追加（Append-Only），无 UPDATE/DELETE |
| PG 协议兼容 | PostgreSQL wire protocol v3.0，psql 直连 |
| 列式存储 | Apache Parquet + Arrow，Bloom 过滤器加速查询 |
| 企业安全 | TLS 1.3 + P-521 ECDHE + mTLS + AES-256-GCM |
| 时间点快照 | 取证追踪、因果链分析、锁冲突检测 |
| RBAC | 角色权限控制（Admin/Auditor/Writer/Reader） |
| 容器化部署 | Docker Compose 一键启动 |

## 快速开始

### 环境要求

- Rust 1.85+
- Docker & Docker Compose（推荐）
- psql（可选，用于连接 PG 协议端口）

### 1. 克隆并启动

```bash
git clone https://gitcode.com/ctkqiang_sr/HunTianDB.git
cd HunTianDB

# 生成 TLS 证书（开发环境）
chmod +x scripts/generate-certs.sh
./scripts/generate-certs.sh

# Docker 启动
docker compose up -d
```

### 2. 使用 psql 连接

混天DB 在端口 **5408** 上暴露 PostgreSQL 兼容接口：

```bash
psql -h localhost -p 5408 -U admin -d huntiandb
```

### 3. 插入和查询数据

```sql
-- 插入安全审计事件
INSERT INTO events (user_id, session_id, event_type, lock_id, zone, region, status_code, ip_address)
VALUES (42, 1001, 1, 0, 3, 1, 200, 2130706433);

-- 查询最近事件
SELECT * FROM events WHERE user_id = 42 ORDER BY timestamp DESC LIMIT 10;
```

### 4. 访问 Portal 前端

浏览器打开 `http://localhost:5000`，使用默认账号登录：
- 用户名: `admin`
- 密码: `admin123`

## 项目结构

```
HunTianDB/
├── backend/          # Rust 核心引擎
│   ├── src/
│   │   ├── server/   # TLS 监听器 + PG 协议 + REST API
│   │   ├── auth/     # mTLS, SCRAM, JWT, RBAC, 加密
│   │   ├── query/    # SQL 解析、优化、SIMD 执行
│   │   ├── storage/  # RingBuffer, WAL, Parquet 读写
│   │   ├── snapshot/ # 快照管理、取证追踪
│   │   └── metrics/  # 日志 + Prometheus
│   └── tests/        # 集成测试
├── frontend/         # React Portal (TDesign + TanStack)
├── docs/zh/          # 中文文档
├── scripts/          # TLS 证书生成、数据库初始化
├── docker-compose.yml
└── Cargo.toml        # Rust workspace 配置
```

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 语言 | Rust (Edition 2021) |
| 异步运行时 | Tokio |
| 列式存储 | Apache Arrow 53 + Parquet 53 |
| 网络 | tokio-rustls (TLS 1.3) |
| 加密 | ring + aes-gcm + hkdf (SHA-256) |
| SQL 解析 | sqlparser-rs |
| 前端 | React 18 + TDesign + TanStack Query |
| 容器化 | Docker + Docker Compose |

## 配置

参考 `.env.example` 文件，核心环境变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DB_ENCRYPTION_KEY` | AES-256 加密密钥（base64） | 必填 |
| `POSTGRES_PORT` | PG 线协议端口 | 5408 |
| `REST_PORT` | REST API 端口 | 5000 |
| `JWT_SECRET` | JWT 签名密钥 | 开发默认值 |

## 许可证

Apache-2.0

---

如果您觉得本项目对您有帮助，欢迎请我喝杯咖啡 ☕️

作者: 钟智强
邮箱: ctkqiang@dingtalk.com
仓库: https://gitcode.com/ctkqiang_sr/HunTianDB
