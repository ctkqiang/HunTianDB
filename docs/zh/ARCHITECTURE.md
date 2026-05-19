# 混天DB 系统架构

## 概述

混天DB 采用 **写入优化 + 列式读取** 的双路径架构。写入路径追求极致吞吐（1M ops/sec），读取路径利用列式存储和 Bloom 过滤器实现亚秒级查询。

## 系统架构图

```
                    ┌──────────────────────────────┐
                    │         客户端层              │
                    │  psql / pgx / React Portal   │
                    └──────┬───────────┬───────────┘
                           │           │
                    PG:5408│           │REST:5000
                           │           │
┌──────────────────────────┴───────────┴──────────────┐
│                    混天DB 核心引擎                    │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ TLS Listener│  │ REST Handler │  │ Connection │  │
│  │ (rustls)    │  │ (axum)       │  │ Manager    │  │
│  └──────┬──────┘  └──────┬───────┘  └────────────┘  │
│         │                │                            │
│  ┌──────┴────────────────┴───────────────────────┐   │
│  │              Auth Layer                        │   │
│  │  mTLS ◇ SCRAM-SHA-256 ◇ JWT ◇ RBAC           │   │
│  └──────────────────────┬────────────────────────┘   │
│                         │                             │
│  ┌──────────────────────┴────────────────────────┐   │
│  │              Query Engine                      │   │
│  │  Parser → Validator → Planner → Optimizer     │   │
│  │                    ↓                           │   │
│  │         SIMD Vectorized Executor               │   │
│  └──────────────────────┬────────────────────────┘   │
│                         │                             │
│  ┌──────────────────────┴────────────────────────┐   │
│  │              Storage Engine                    │   │
│  │                                                │   │
│  │  ┌──────────┐   ┌─────┐   ┌────────────────┐  │   │
│  │  │RingBuffer│ → │ WAL │ → │ Parquet Writer │  │   │
│  │  │(lock-free)│   │(AES)│   │(Arrow/Parquet) │  │   │
│  │  └──────────┘   └─────┘   └────────────────┘  │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

## 写入路径详解

### 阶段 1: 连接建立与认证

```
Client → TLS Handshake (P-521 ECDHE)
       → StartupMessage (user, database)
       → AuthenticationOk
       → ReadyForQuery
```

### 阶段 2: 事件接收

```
Client → Parse (SQL) → Validate → Execute
                           ↓
                      RingBuffer.push(event)  ← O(1), lock-free
```

环形缓冲区 (`RingBuffer`) 是基于 `crossbeam::ArrayQueue` 的无锁 MPSC 队列，支持：
- 单生产者: 100ns/op
- 多生产者: 200ns/op (CAS contention)
- 容量: 1M events（可配置）

### 阶段 3: WAL 持久化

```
每 100ms 或 100K events:
  RingBuffer.drain_batch() → bincode 序列化
                           → AES-256-GCM 加密
                           → 写入 WAL 文件
                           → fsync 刷盘
```

WAL 格式（每条记录）:
```
[长度:4B][Nonce:12B][密文:N][认证标签:16B]
```

### 阶段 4: Parquet 列式归档

```
后台线程:
  WAL replay → Arrow RecordBatch
             → 列级压缩（Dict/Delta/Snappy）
             → Parquet 文件写入
             → Bloom 过滤器生成
             → partition_manifest.json 更新
```

## 读取路径详解

```
Query → Parser (sqlparser-rs)
      → Validator (表/列存在性检查)
      → Planner (生成执行计划)
      → Optimizer (谓词下推 + 分区裁剪)
      → Executor:
          1. 加载 partition_manifest
          2. Bloom 过滤器快速跳过 (0.1% 误报)
          3. SIMD 向量化过滤 (1024行/批)
          4. 流式返回结果（不物化全部行）
```

## 数据模型

```rust
Event {
    id: i64,              // 唯一标识（单调递增）
    timestamp: DateTime,   // 事件时间戳（UTC毫秒）
    user_id: i32,          // 用户ID（字典编码）
    session_id: i64,       // 会话ID（字典编码）
    event_type: i8,        // 1=认证 2=授权 3=数据访问 4=配置变更
    lock_id: i32,          // 关联锁ID（字典编码）
    zone: i8,              // 安全分区（0-255）
    region: i8,            // 地理区域
    status_code: i16,      // 操作状态码
    ip_address: i32,       // 客户端IPv4
    parent_event_id: i64,  // 父事件ID（因果链）
    error_msg: String?,    // 错误消息（Snappy）
    metadata_json: String?,// 扩展元数据（Snappy）
}
```

压缩后每行约 56-100 字节。

## 分区策略

按时间分层分区：`/data/YYYY-MM-DD/HH-MM/events.parquet`

每个分区包含：
- `events.parquet`: 列式数据文件
- `partition_manifest.json`: 分区元数据（时间范围、行数、Bloom 过滤器）
- 单分区最大 1M 事件，约 100MB

## 并发模型

- **写入**: MPSC 无锁队列，单消费者线程刷盘
- **读取**: 多 reader 并行，Tokio async I/O
- **连接**: 每连接一个 Tokio task
- **快照**: RwLock 保护注册表，读多写少

## 性能目标

| 指标 | 目标 |
|------|------|
| 写入吞吐 | 1M events/sec |
| WAL 延迟 | < 1ms (p99) |
| 查询延迟 | < 100ms (10亿行扫描) |
| Parquet 压缩 | 100ms / 100K events |
| 并发连接 | 10,000+ |
