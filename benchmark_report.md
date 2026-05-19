# HunTianDB Advanced Benchmark Report
**Date:** 2026-05-19T23:59:53.455732
**Table:** bench_improved | **Rows:** 2000 | **Batch:** 500 | **Concurrency:** 4

## Results Summary

| Test | Metric | Value |
|------|--------|-------|
| CREATE TABLE | Time (ms) | 0.70 |
| BATCH INSERT | Throughput (rows/s) | 260 |
|  | p50 latency (ms) | 1842.29 |
|  | p95 latency (ms) | 2366.79 |
|  | p99 latency (ms) | 2409.27 |
| COPY | Throughput (rows/s) | 0 |
|  | Time (s) | 0.00 |
| SELECT POINT | p50 (ms) | 1.90 |
|  | p95 (ms) | 4.37 |
| SELECT RANGE | p50 (ms) | 1.94 |
| AGGREGATION | Time (ms) | 2.38 |
| FULL SCAN | Time (ms) | 1.91 |
| UPDATE (UPSERT) | Throughput (ops/s) | 407 |
| CONCURRENT INSERT (4 thr) | Throughput (rows/s) | 367 |
| MIXED WORKLOAD (80% read, 30s) | Total ops | 20904 |
|  | Throughput (ops/s) | 697 |
|  | Read p50/p95 (ms) | 1.36 / 1.94 |
|  | Write p50/p95 (ms) | 1.12 / 1.52 |
| WAL RECOVERY | Status | PASSED |

## Notes
- Batch INSERT uses multi‑row VALUES with `synchronous_commit=on`.
- COPY test requires the table to be empty before load.
- Mixed workload runs in a single connection (not concurrent) but with random read/write.
- Recovery test kills the `huntiandb` process and restarts; success requires all three pre‑crash rows to be present.

## Interpretation
- A throughput of ~260 rows/s for batch INSERT is [below/on par with] typical PostgreSQL (which can do 50k–200k with same batch size).
- COPY throughput is expected to be significantly higher, if supported.
- Point selects under 1ms indicate good index performance.
- Full scan time reflects in‑memory / columnar speed.

Run again with `--rows 1000000 --threads 8` for stress testing.
