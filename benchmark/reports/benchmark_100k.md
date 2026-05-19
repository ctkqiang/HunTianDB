# HunTianDB Benchmark Report
**Date**: 2026-05-19 14:13:31 | **Rows**: 100000 | **Batch**: 1000
**Table**: bench_audit_logs (20 columns, long text payloads)

[CREATE TABLE] 843.25µs | 表 'bench_audit_logs' 已创建 (20 列)
  0 / 100000 (0%) | 2.30s | 0 r/s
  0 / 100000 (0%) | 4.60s | 0 r/s
  0 / 100000 (0%) | 6.92s | 0 r/s
  0 / 100000 (0%) | 9.25s | 0 r/s
  0 / 100000 (0%) | 11.58s | 0 r/s
  0 / 100000 (0%) | 14.78s | 0 r/s
  0 / 100000 (0%) | 17.18s | 0 r/s
  0 / 100000 (0%) | 19.45s | 0 r/s
  0 / 100000 (0%) | 21.58s | 0 r/s
  0 / 100000 (0%) | 23.88s | 0 r/s
[INSERT 0/100000] 23.88s | 0 rows/s
[SELECT * LIMIT 10K] 1.44ms | 0 rows | 0.4ms
[AGGREGATION] 221.08µs | 0 groups | 0.0ms
[POINT LOOKUP] 219.58µs | 0 rows | 0.0ms
[COMPLEX QUERY] 222.67µs | 0 rows | 0.0ms

## Summary
Total time: 23.91s | Rows: 0 | Table: bench_audit_logs

## Reference Comparison (public benchmarks, not measured by this tool)
| Operation | HunTianDB (measured) | MySQL InnoDB | PostgreSQL | QuestDB |
|-----------|---------------------|--------------|------------|---------|
| CREATE TABLE | 843.25µs | ~50ms | ~30ms | ~20ms |
| INSERT 0 rows | 23.88s (0 r/s) | ~150K r/s | ~300K r/s | ~4-11M r/s |
| SELECT * LIMIT 10K | 1.44ms | ~200ms | ~150ms | ~50ms |
| Aggregation | 221.08µs | ~500ms | ~300ms | ~20ms |
| Point Lookup | 219.58µs | ~1ms | ~1ms | ~5ms |
| Complex Query | 222.67µs | ~800ms | ~500ms | ~100ms |

**Note**: HunTianDB currently uses in-memory HashMap storage. QuestDB references are for ILP protocol. MySQL/PostgreSQL numbers are industry references for comparison.
