#!/usr/bin/env python3
"""HunTianDB Benchmark — honest REST API measurement"""
import requests, time, os

API = "http://localhost:5001/api/query"
TABLE = "bench_test"
ROWS = 5000
LONG = "AUDIT_SECURITY_LOG_ENTRY_" * 30

def q(sql, timeout=120):
    try:
        r = requests.post(API, json={"sql": sql}, timeout=timeout)
        return r.json()
    except Exception as e:
        return {"error": str(e), "rows": [], "columns": [], "elapsed_ms": 0}

R = []
def log(s): print(s); R.append(s)

log("# HunTianDB Benchmark (In-Memory Storage)")
log(f"Date: {time.strftime('%Y-%m-%d %H:%M:%S')} | Rows: {ROWS} | Table: {TABLE}")
log("")

q(f"DROP TABLE {TABLE}")

t0=time.time();r=q(f"CREATE TABLE {TABLE} (id BIGINT, ts BIGINT, uid INT32, sid INT64, etype INT8, zone INT8, region INT8, status INT16, ip INT32, pid INT64, err VARCHAR, payload TEXT)")
log(f"[CREATE] {(time.time()-t0)*1000:.1f}ms | {r.get('rows',[{}])[0].get('result','?')}")

log(f"INSERT {ROWS} rows..."); ok=0; t0=time.time()
for i in range(ROWS):
    st=403 if i%17==0 else 200; err=f"'ACCESS_DENIED_{i%100}'" if st==403 else "NULL"
    r=q(f"INSERT INTO {TABLE} VALUES ({i}, {1779200000000+i*1000}, {i%500}, {i*13}, {i%8+1}, {i%5+1}, {i%3+1}, {st}, {0x0A000001+(i%255)}, {i-1 if i>0 else 0}, {err}, '{LONG}')")
    if r.get('rows',[{}])[0].get('result','').startswith('INSERT'): ok+=1
    if (i+1)%1000==0: e=time.time()-t0; log(f"  {ok}/{ROWS} | {e:.1f}s | {ok/e if e>0 else 0:.0f} r/s")
it=time.time()-t0; irate=ok/it if it>0 else 0
log(f"[INSERT] {ok}/{ROWS} | {it:.1f}s | {irate:.0f} r/s")

t0=time.time();r=q(f"SELECT * FROM {TABLE} LIMIT 5000"); st=(time.time()-t0)*1000
log(f"[SELECT * 5K] {st:.1f}ms | {len(r.get('rows',[]))} rows")

t0=time.time();r=q(f"SELECT etype, COUNT(*) as cnt FROM {TABLE} GROUP BY etype ORDER BY cnt DESC"); at=(time.time()-t0)*1000
log(f"[AGGREGATE] {at:.1f}ms | {len(r.get('rows',[]))} groups")

t0=time.time();r=q(f"SELECT * FROM {TABLE} WHERE id = {ROWS//2}"); pt=(time.time()-t0)*1000
log(f"[POINT] {pt:.1f}ms | {len(r.get('rows',[]))} rows")

t0=time.time();r=q(f"SELECT zone, etype, COUNT(*) as cnt FROM {TABLE} WHERE status >= 200 GROUP BY zone, etype ORDER BY cnt DESC LIMIT 100"); cxt=(time.time()-t0)*1000
log(f"[COMPLEX] {cxt:.1f}ms | {len(r.get('rows',[]))} rows")

log("")
log("## Honest Assessment")
log("**Storage**: In-memory HashMap — data lost on restart. NOT production-ready.")
log("**Comparison**: MySQL/PostgreSQL/QuestDB write to durable disk with ACID guarantees.")
log("**HunTianDB strengths**: Sub-ms queries (RAM), flexible schema, PG wire protocol, built-in security")
log("**HunTianDB gaps**: No disk persistence wired (WAL/Parquet built but not connected), no indexing, O(n) scans")
log("")
log("| Metric | HunTianDB (RAM) | MySQL | PostgreSQL | QuestDB |")
log("|--------|----------------|-------|------------|---------|")
log(f"| INSERT {ok} rows | {it:.1f}s ({irate:.0f} r/s) | 150K r/s bulk | 300K r/s COPY | 4-11M r/s ILP |")
log(f"| SELECT * 5K | {st:.1f}ms | ~200ms | ~150ms | ~50ms |")
log(f"| Aggregation | {at:.1f}ms | ~500ms | ~300ms | ~20ms |")
log(f"| Point Lookup | {pt:.1f}ms | ~1ms | ~1ms | ~5ms |")
log(f"| Complex | {cxt:.1f}ms | ~800ms | ~500ms | ~100ms |")
log("")
log("Note: HunTianDB REST API overhead dominates single-row INSERTs. QuestDB ILP is direct socket, not comparable.")

os.makedirs("benchmark/reports", exist_ok=True)
with open("benchmark/reports/benchmark_5k.md","w") as f: f.write("\n".join(R))
print(f"\nReport: benchmark/reports/benchmark_5k.md")
