---
name: Performance issue / 性能问题
about: Report slow queries, high latency, or throughput problems
title: '[PERF] '
labels: performance
assignees: ''
---

## Summary / 摘要

(Describe the performance issue, e.g., "INSERT throughput dropped from 7000 rows/s to 2000 rows/s after upgrading.")

---

## Benchmark Results / 基准测试结果

| Metric                    | Before | After | Expected |
| ------------------------- | ------ | ----- | -------- |
| INSERT rows/s (batch=500) |        |       |          |
| SELECT point p99 (ms)     |        |       |          |
| SELECT full scan (ms)     |        |       |          |
| UPDATE ops/s              |        |       |          |
| WAL recovery time         |        |       |          |

**Attach benchmark report:** (link or paste output)

---

## Reproduction / 复现方法

**Data size:** (rows / GB)  
**Query or workload:**

```sql

```
