#!/usr/bin/env python3
"""
HunTianDB Comprehensive Benchmark

Measures:
- CREATE TABLE
- INSERT (batch, COPY, concurrent)
- SELECT (point, range, aggregation, full scan, indexed)
- UPDATE / UPSERT
- DELETE (optional)
- WAL crash recovery
- Latency percentiles (p50, p95, p99)
- Throughput scaling with concurrency

Dependencies: pip install psycopg2-binary requests
"""

import argparse
import json
import multiprocessing
import os
import random
import subprocess
import sys
import threading
import time
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Tuple

import psycopg2
import psycopg2.extras
import requests

# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------
DB_HOST = "127.0.0.1"
DB_PORT = 5408
DB_USER = "admin"
DB_PASSWORD = "admin123"
DB_NAME = "huntiandb"
REST_API = "http://localhost:58409/api/query"

LONG_TEXT = "SEC_AUDIT_PAYLOAD_" * 20  # ~460 bytes
LARGE_TEXT = "BIG_DATA_" * 1000        # ~9KB

TABLE = "bench_improved"

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
def get_conn():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER,
        password=DB_PASSWORD, dbname=DB_NAME
    )

def execute_sql(sql, params=None, fetch=False, ignore_errors=False):
    """Execute SQL with optional parameters, return (rows, elapsed_ms)"""
    conn = get_conn()
    cur = conn.cursor()
    start = time.perf_counter()
    try:
        cur.execute(sql, params or ())
        if fetch:
            rows = cur.fetchall()
        else:
            rows = None
        conn.commit()
    except Exception as e:
        if ignore_errors:
            conn.rollback()
            rows = None
        else:
            raise
    elapsed = (time.perf_counter() - start) * 1000
    cur.close()
    conn.close()
    return rows, elapsed

def rest_query(sql):
    """Execute via REST API, return dict"""
    try:
        resp = requests.post(REST_API, json={"sql": sql}, timeout=60)
        return resp.json()
    except Exception as e:
        return {"error": str(e), "rows": []}

def kill_db():
    subprocess.run(["pkill", "-9", "-f", "huntiandb"], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
    time.sleep(1)

def restart_db():
    enc = os.environ.get("DB_ENCRYPTION_KEY", "JEGl9OTwFUMjPXnVMe/3q9g1uEZtW6MvSH3GaRZFQjo=")
    cmd = f"DB_ENCRYPTION_KEY={enc} REST_PORT=58409 POSTGRES_PORT=5408 nohup ./target/debug/huntiandb > /tmp/huntiandb.log 2>&1 &"
    os.system(cmd)
    # Wait for availability
    for _ in range(20):
        time.sleep(1)
        try:
            conn = get_conn()
            conn.close()
            return True
        except:
            continue
    return False

def percentile(data, p):
    if not data:
        return 0
    data_sorted = sorted(data)
    k = (len(data_sorted) - 1) * p / 100
    f = int(k)
    c = k - f
    if f + 1 < len(data_sorted):
        return data_sorted[f] + c * (data_sorted[f+1] - data_sorted[f])
    return data_sorted[f]

# ------------------------------------------------------------
# Benchmarks
# ------------------------------------------------------------
def bench_create_table():
    # Drop table if exists (ignore error if it doesn't exist)
    execute_sql(f"DROP TABLE {TABLE}", ignore_errors=True)
    sql = f"""
    CREATE TABLE {TABLE} (
        id BIGINT PRIMARY KEY,
        ts BIGINT,
        uid INT,
        sid BIGINT,
        etype SMALLINT,
        zone SMALLINT,
        region SMALLINT,
        status SMALLINT,
        ip INT,
        pid BIGINT,
        err VARCHAR(50),
        payload TEXT,
        large_payload TEXT
    )
    """
    _, elapsed = execute_sql(sql)
    return elapsed

def bench_insert_batch(rows, batch_size, sync_commit=True):
    """Batch INSERT using multi‑value syntax"""
    if not sync_commit:
        execute_sql("SET LOCAL synchronous_commit TO OFF")
    conn = get_conn()
    cur = conn.cursor()
    start = time.perf_counter()
    inserted = 0
    latencies = []
    for b in range(0, rows, batch_size):
        vals = []
        for i in range(b, min(b+batch_size, rows)):
            payload = LONG_TEXT if i % 2 == 0 else LARGE_TEXT
            vals.append(f"({i},{1779200000000+i*1000},{i%500},{i*13},{i%8+1},{i%5+1},{i%3+1},200,{0x0A000001+(i%255)},{i-1 if i>0 else 0},'OK','{payload}','{payload}')")
        sql = f"INSERT INTO {TABLE} VALUES {','.join(vals)}"
        t0 = time.perf_counter()
        cur.execute(sql)
        conn.commit()
        latencies.append((time.perf_counter() - t0) * 1000)
        inserted += len(vals)
    elapsed = time.perf_counter() - start
    cur.close()
    conn.close()
    return inserted, elapsed, latencies

def bench_copy(rows):
    """COPY FROM STDIN (fastest bulk load)"""
    conn = get_conn()
    cur = conn.cursor()
    start = time.perf_counter()
    with open("/tmp/copy_data.csv", "w") as f:
        for i in range(rows):
            payload = LONG_TEXT if i % 2 == 0 else LARGE_TEXT
            f.write(f"{i},{1779200000000+i*1000},{i%500},{i*13},{i%8+1},{i%5+1},{i%3+1},200,{0x0A000001+(i%255)},{i-1 if i>0 else 0},OK,{payload},{payload}\n")
    with open("/tmp/copy_data.csv", "r") as f:
        cur.copy_from(f, TABLE, sep=",", columns=(
            "id","ts","uid","sid","etype","zone","region","status","ip","pid","err","payload","large_payload"))
    conn.commit()
    elapsed = time.perf_counter() - start
    cur.close()
    conn.close()
    return rows, elapsed

def bench_select_point(iterations):
    latencies = []
    for i in range(iterations):
        _, elapsed = execute_sql(f"SELECT * FROM {TABLE} WHERE id = %s", (i % 100000,), fetch=True)
        latencies.append(elapsed)
    return latencies

def bench_select_range(iterations, range_size=100):
    latencies = []
    for i in range(iterations):
        start_id = (i * 997) % 90000
        _, elapsed = execute_sql(
            f"SELECT * FROM {TABLE} WHERE id BETWEEN %s AND %s",
            (start_id, start_id + range_size), fetch=True
        )
        latencies.append(elapsed)
    return latencies

def bench_select_aggregation():
    _, elapsed = execute_sql(
        f"SELECT etype, COUNT(*), AVG(uid), SUM(sid) FROM {TABLE} GROUP BY etype",
        fetch=True
    )
    return elapsed

def bench_select_full_scan():
    _, elapsed = execute_sql(f"SELECT * FROM {TABLE}", fetch=True)
    return elapsed

def bench_update(rows, batch_size):
    """UPDATE using re‑INSERT (overwrite)"""
    conn = get_conn()
    cur = conn.cursor()
    start = time.perf_counter()
    updated = 0
    for b in range(0, rows, batch_size):
        vals = []
        for i in range(b, min(b+batch_size, rows)):
            vals.append(f"({i},{1779400000000},{i%500+1000},{i*13+999},9,5,3,500,0,0,'UPDATED','{LONG_TEXT}','{LARGE_TEXT}')")
        sql = f"INSERT INTO {TABLE} VALUES {','.join(vals)} ON CONFLICT (id) DO UPDATE SET ts=EXCLUDED.ts, status=EXCLUDED.status"
        cur.execute(sql)
        conn.commit()
        updated += len(vals)
    elapsed = time.perf_counter() - start
    cur.close()
    conn.close()
    return updated, elapsed

def bench_concurrent_inserts(rows, threads, batch_size):
    """Run multiple threads inserting in parallel (each thread its own connection)"""
    rows_per_thread = rows // threads
    results = []

    def worker(tid):
        conn = get_conn()
        cur = conn.cursor()
        start = time.perf_counter()
        inserted = 0
        for b in range(0, rows_per_thread, batch_size):
            vals = []
            for i in range(b, min(b+batch_size, rows_per_thread)):
                global_id = tid * rows_per_thread + i
                vals.append(f"({global_id},{1779200000000+global_id*1000},{global_id%500},{global_id*13},1,1,1,200,123,0,'OK','{LONG_TEXT}','{LARGE_TEXT}')")
            cur.execute(f"INSERT INTO {TABLE} VALUES {','.join(vals)}")
            conn.commit()
            inserted += len(vals)
        elapsed = time.perf_counter() - start
        cur.close()
        conn.close()
        results.append((inserted, elapsed))

    threads_list = []
    for i in range(threads):
        t = threading.Thread(target=worker, args=(i,))
        t.start()
        threads_list.append(t)
    for t in threads_list:
        t.join()
    total_rows = sum(r[0] for r in results)
    total_time = max(r[1] for r in results)  # wall time (last finished)
    return total_rows, total_time

def bench_mixed_workload(duration_sec, read_ratio=0.8):
    """Run mix of reads and writes for given duration"""
    stop = time.time() + duration_sec
    reads = 0
    writes = 0
    read_latencies = []
    write_latencies = []
    conn = get_conn()
    cur = conn.cursor()
    i = 0
    while time.time() < stop:
        i += 1
        if random.random() < read_ratio:
            # random point read
            t0 = time.perf_counter()
            cur.execute(f"SELECT * FROM {TABLE} WHERE id = %s", (i % 100000,))
            cur.fetchall()
            read_latencies.append((time.perf_counter() - t0) * 1000)
            reads += 1
        else:
            # upsert
            t0 = time.perf_counter()
            cur.execute(f"INSERT INTO {TABLE} (id,ts,uid,sid,etype,zone,region,status,ip,pid,err,payload,large_payload) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO UPDATE SET ts=EXCLUDED.ts",
                        (i % 100000, int(time.time()*1000), i%500, i*13, 1,1,1,200,123,0,'OK', LONG_TEXT, LARGE_TEXT))
            conn.commit()
            write_latencies.append((time.perf_counter() - t0) * 1000)
            writes += 1
    cur.close()
    conn.close()
    return reads, writes, read_latencies, write_latencies

def bench_recovery():
    """WAL crash recovery test"""
    # Drop if exists (ignore error)
    execute_sql("DROP TABLE recovery_test", ignore_errors=True)
    execute_sql("CREATE TABLE recovery_test (id INT, msg VARCHAR(100))")
    execute_sql("INSERT INTO recovery_test VALUES (1, 'pre_crash_1'), (2, 'pre_crash_2'), (3, 'pre_crash_3')")
    print("  Inserted 3 rows. Simulating crash...")
    kill_db()
    time.sleep(2)
    if not restart_db():
        return False
    rows, _ = execute_sql("SELECT * FROM recovery_test", fetch=True)
    return len(rows) >= 3

# ------------------------------------------------------------
# Main
# ------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="HunTianDB Comprehensive Benchmark")
    parser.add_argument("--rows", type=int, default=100000, help="Number of rows for bulk tests")
    parser.add_argument("--batch", type=int, default=500, help="Batch size for INSERT")
    parser.add_argument("--threads", type=int, default=4, help="Concurrency level")
    parser.add_argument("--duration", type=int, default=30, help="Duration for mixed workload (sec)")
    parser.add_argument("--skip-copy", action="store_true", help="Skip COPY benchmark")
    parser.add_argument("--output", type=str, default="benchmark_report.md", help="Output markdown file")
    args = parser.parse_args()

    # Ensure table is clean (ignore missing table errors)
    execute_sql(f"DROP TABLE {TABLE}", ignore_errors=True)
    results = {}

    print("# HunTianDB Advanced Benchmark Report")
    print(f"Date: {datetime.now().isoformat()}")
    print(f"Rows: {args.rows}, Batch size: {args.batch}, Concurrency: {args.threads}\n")

    # 1. CREATE
    t = bench_create_table()
    results["create_table_ms"] = t
    print(f"1. CREATE TABLE: {t:.2f} ms")

    # 2. Batch INSERT (synchronous commit)
    inserted, elapsed, latencies = bench_insert_batch(args.rows, args.batch, sync_commit=True)
    results["batch_insert_rows"] = inserted
    results["batch_insert_sec"] = elapsed
    results["batch_insert_throughput"] = inserted / elapsed if elapsed > 0 else 0
    results["batch_insert_latency_p50"] = percentile(latencies, 50)
    results["batch_insert_latency_p95"] = percentile(latencies, 95)
    results["batch_insert_latency_p99"] = percentile(latencies, 99)
    print(f"2. BATCH INSERT: {inserted} rows in {elapsed:.2f}s = {results['batch_insert_throughput']:.0f} rows/s")
    print(f"   Latency (ms): p50={results['batch_insert_latency_p50']:.1f} p95={results['batch_insert_latency_p95']:.1f} p99={results['batch_insert_latency_p99']:.1f}")

    # 3. COPY (if available)
    if not args.skip_copy:
        try:
            copied, copy_elapsed = bench_copy(args.rows)
            results["copy_rows"] = copied
            results["copy_sec"] = copy_elapsed
            results["copy_throughput"] = copied / copy_elapsed if copy_elapsed > 0 else 0
            print(f"3. COPY: {copied} rows in {copy_elapsed:.2f}s = {results['copy_throughput']:.0f} rows/s")
        except Exception as e:
            print(f"3. COPY: FAILED - {e}")

    # 4. SELECT benchmarks
    print("\n4. SELECT benchmarks:")
    lat = bench_select_point(1000)
    results["select_point_p50"] = percentile(lat, 50)
    results["select_point_p95"] = percentile(lat, 95)
    results["select_point_p99"] = percentile(lat, 99)
    print(f"   Point select (1000 ops): p50={results['select_point_p50']:.2f}ms p95={results['select_point_p95']:.2f}ms")

    lat = bench_select_range(500, range_size=100)
    results["select_range_p50"] = percentile(lat, 50)
    results["select_range_p95"] = percentile(lat, 95)
    print(f"   Range select (500 ops): p50={results['select_range_p50']:.2f}ms")

    agg_ms = bench_select_aggregation()
    results["select_aggregation_ms"] = agg_ms
    print(f"   Aggregation (GROUP BY): {agg_ms:.2f} ms")

    full_ms = bench_select_full_scan()
    results["select_full_scan_ms"] = full_ms
    print(f"   Full table scan: {full_ms:.2f} ms")

    # 5. UPDATE (upsert)
    updated, upd_elapsed = bench_update(min(2000, args.rows), args.batch)
    results["update_rows"] = updated
    results["update_sec"] = upd_elapsed
    results["update_throughput"] = updated / upd_elapsed if upd_elapsed > 0 else 0
    print(f"\n5. UPDATE (UPSERT): {updated} rows in {upd_elapsed:.2f}s = {results['update_throughput']:.0f} ops/s")

    # 6. Concurrent inserts
    rows_conc, time_conc = bench_concurrent_inserts(min(50000, args.rows), args.threads, args.batch)
    results["concurrent_threads"] = args.threads
    results["concurrent_rows"] = rows_conc
    results["concurrent_sec"] = time_conc
    results["concurrent_throughput"] = rows_conc / time_conc if time_conc > 0 else 0
    print(f"6. CONCURRENT INSERT ({args.threads} threads): {rows_conc} rows in {time_conc:.2f}s = {results['concurrent_throughput']:.0f} rows/s")

    # 7. Mixed workload
    reads, writes, read_lats, write_lats = bench_mixed_workload(args.duration, read_ratio=0.8)
    results["mixed_duration_sec"] = args.duration
    results["mixed_reads"] = reads
    results["mixed_writes"] = writes
    results["mixed_read_p50"] = percentile(read_lats, 50)
    results["mixed_read_p95"] = percentile(read_lats, 95)
    results["mixed_write_p50"] = percentile(write_lats, 50)
    results["mixed_write_p95"] = percentile(write_lats, 95)
    total_ops = reads + writes
    throughput = total_ops / args.duration
    results["mixed_total_throughput"] = throughput
    print(f"7. MIXED WORKLOAD ({args.duration}s, 80% read): {total_ops} ops = {throughput:.0f} ops/s")
    print(f"   Read lat (ms): p50={results['mixed_read_p50']:.2f} p95={results['mixed_read_p95']:.2f}")
    print(f"   Write lat (ms): p50={results['mixed_write_p50']:.2f} p95={results['mixed_write_p95']:.2f}")

    # 8. Crash recovery
    recovered = bench_recovery()
    results["recovery_success"] = recovered
    print(f"\n8. WAL CRASH RECOVERY: {'PASSED' if recovered else 'FAILED'}")

    # Generate markdown report
    report = f"""# HunTianDB Advanced Benchmark Report
**Date:** {datetime.now().isoformat()}
**Table:** {TABLE} | **Rows:** {args.rows} | **Batch:** {args.batch} | **Concurrency:** {args.threads}

## Results Summary

| Test | Metric | Value |
|------|--------|-------|
| CREATE TABLE | Time (ms) | {results['create_table_ms']:.2f} |
| BATCH INSERT | Throughput (rows/s) | {results['batch_insert_throughput']:.0f} |
|  | p50 latency (ms) | {results['batch_insert_latency_p50']:.2f} |
|  | p95 latency (ms) | {results['batch_insert_latency_p95']:.2f} |
|  | p99 latency (ms) | {results['batch_insert_latency_p99']:.2f} |
"""
    if not args.skip_copy:
        report += f"""| COPY | Throughput (rows/s) | {results.get('copy_throughput',0):.0f} |
|  | Time (s) | {results.get('copy_sec',0):.2f} |
"""
    report += f"""| SELECT POINT | p50 (ms) | {results['select_point_p50']:.2f} |
|  | p95 (ms) | {results['select_point_p95']:.2f} |
| SELECT RANGE | p50 (ms) | {results['select_range_p50']:.2f} |
| AGGREGATION | Time (ms) | {results['select_aggregation_ms']:.2f} |
| FULL SCAN | Time (ms) | {results['select_full_scan_ms']:.2f} |
| UPDATE (UPSERT) | Throughput (ops/s) | {results['update_throughput']:.0f} |
| CONCURRENT INSERT ({args.threads} thr) | Throughput (rows/s) | {results['concurrent_throughput']:.0f} |
| MIXED WORKLOAD (80% read, {args.duration}s) | Total ops | {reads + writes} |
|  | Throughput (ops/s) | {results['mixed_total_throughput']:.0f} |
|  | Read p50/p95 (ms) | {results['mixed_read_p50']:.2f} / {results['mixed_read_p95']:.2f} |
|  | Write p50/p95 (ms) | {results['mixed_write_p50']:.2f} / {results['mixed_write_p95']:.2f} |
| WAL RECOVERY | Status | {'PASSED' if results['recovery_success'] else 'FAILED'} |

## Notes
- Batch INSERT uses multi‑row VALUES with `synchronous_commit=on`.
- COPY test requires the table to be empty before load.
- Mixed workload runs in a single connection (not concurrent) but with random read/write.
- Recovery test kills the `huntiandb` process and restarts; success requires all three pre‑crash rows to be present.

## Interpretation
- A throughput of ~{results['batch_insert_throughput']:.0f} rows/s for batch INSERT is [below/on par with] typical PostgreSQL (which can do 50k–200k with same batch size).
- COPY throughput is expected to be significantly higher, if supported.
- Point selects under 1ms indicate good index performance.
- Full scan time reflects in‑memory / columnar speed.

Run again with `--rows 1000000 --threads 8` for stress testing.
"""
    with open(args.output, "w") as f:
        f.write(report)
    print(f"\nReport saved to {args.output}")

if __name__ == "__main__":
    main()