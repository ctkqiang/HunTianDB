# HunTianDB — Timeseries Security Database

HunTianDB is an immutable, append-only timeseries database optimized for security audit logging and financial data. 1M events/sec write throughput, PostgreSQL wire protocol compatible, enterprise-grade security.

## Quick Start

```bash
docker compose up -d
psql -h localhost -p 5408 -U admin -d huntiandb
```

## Key Features

- 1M events/sec sustained write
- Immutable append-only storage
- PostgreSQL protocol v3.0 compatible
- TLS 1.3 + P-521 ECDHE + AES-256-GCM
- Apache Arrow/Parquet columnar storage
- Point-in-time snapshots & forensic tracing
- RBAC (Admin/Auditor/Writer/Reader)

## Documentation

Full documentation in Chinese: [docs/zh/](../zh/README.md)

Author: 钟智强
Email: ctkqiang@dingtalk.com
