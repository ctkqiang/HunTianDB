//! HunTianDB Enterprise Benchmark — 1M rows CRUD
//! Run: cargo run --bin bench
//! Reports: benchmark/reports/

use std::io::Write;
use std::time::Instant;

const API: &str = "http://localhost:5001/api/query";
const TABLE: &str = "bench_audit_logs";
const ROWS: u64 = 100_000; // 100K for realistic test duration
const BATCH: u64 = 1000;

fn main() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(run());
}

async fn run() {
    let client = reqwest::Client::new();
    let mut report = String::new();
    let t0 = Instant::now();

    macro_rules! log { ($($arg:tt)*) => { let s = format!($($arg)*); println!("{}", s); report.push_str(&s); report.push('\n'); }; }

    async fn exec(client: &reqwest::Client, sql: &str) -> serde_json::Value {
        let res = client
            .post(API)
            .json(&serde_json::json!({"sql": sql}))
            .send()
            .await;
        match res {
            Ok(r) => r
                .json()
                .await
                .unwrap_or(serde_json::json!({"error":"parse failed"})),
            Err(e) => serde_json::json!({"error": format!("{}", e)}),
        }
    }

    log!("# HunTianDB Benchmark Report");
    log!(
        "**Date**: {} | **Rows**: {} | **Batch**: {}",
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S"),
        ROWS,
        BATCH
    );
    log!("**Table**: {} (20 columns, long text payloads)", TABLE);
    log!("");

    let _ = exec(&client, &format!("DROP TABLE {}", TABLE)).await;

    let t1 = Instant::now();
    let r = exec(&client, &format!("CREATE TABLE {} (id BIGINT, ts BIGINT, user_id INT32, session_id INT64, event_type INT8, zone INT8, region INT8, status_code INT16, ip_address INT32, parent_event_id INT64, error_msg VARCHAR, metadata_json VARCHAR, payload TEXT, trace_id VARCHAR, source_ip VARCHAR, user_agent VARCHAR, request_path VARCHAR, response_body TEXT, signature VARCHAR, notes TEXT)", TABLE)).await;
    let ct = t1.elapsed();
    log!(
        "[CREATE TABLE] {:.2?} | {}",
        ct,
        r["rows"][0]["result"].as_str().unwrap_or("?")
    );

    let long = "AUDIT_LOG_".repeat(20) + &"SECURITY_EVENT_PAYLOAD_".repeat(15);
    let t2 = Instant::now();
    let mut ok = 0u64;
    for idx in 0..ROWS {
        let sql = format!("INSERT INTO {} VALUES ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, '{}', '{}', '{}', '{}', '{}.{}.{}.{}', 'Mozilla/5.0 Audit/1.0', '/api/v1/log/{}', '{}', '{}', '{}')",
            TABLE, idx, 1779200000000u64+idx*1000, idx%1000, idx*7, idx%8+1, idx%5+1, idx%3+1,
            if idx%23==0{403}else{200}, 0x0A000001i64+(idx%255) as i64, if idx>0{idx as i64-1}else{0},
            format!("ERR_ACCESS_DENIED_TRACE_{}", idx%1000),
            format!("{{\"zone\":{},\"ip\":\"192.168.{}.{}\"}}", idx%5, idx%255, idx%65535),
            long, format!("trace-{}-{}", idx, uuid::Uuid::new_v4()),
            idx%255, idx%255, idx%255, idx%255, idx%100,
            long.chars().take(100).collect::<String>(),
            format!("sig-{}", idx%10000),
            format!("NOTE_{}", idx%1000)
        );
        let r = exec(&client, &sql).await;
        if r["rows"][0]["result"]
            .as_str()
            .unwrap_or("")
            .starts_with("INSERT")
        {
            ok += 1;
        }
        if (idx + 1) % 10000 == 0 {
            let e = t2.elapsed();
            let rate = ok as f64 / e.as_secs_f64().max(0.001);
            log!(
                "  {} / {} ({:.0}%) | {:.2?} | {:.0} r/s",
                ok,
                ROWS,
                (ok * 100 / ROWS),
                e,
                rate
            );
        }
    }
    let it = t2.elapsed();
    let irate = ok as f64 / it.as_secs_f64().max(0.001);
    log!("[INSERT {}/{}] {:.2?} | {:.0} rows/s", ok, ROWS, it, irate);

    let t3 = Instant::now();
    let r = exec(&client, &format!("SELECT * FROM {} LIMIT 10000", TABLE)).await;
    let st = t3.elapsed();
    log!(
        "[SELECT * LIMIT 10K] {:.2?} | {} rows | {:.1}ms",
        st,
        r["rows"].as_array().map(|a| a.len()).unwrap_or(0),
        r["elapsed_ms"].as_f64().unwrap_or(0.0)
    );

    let t4 = Instant::now();
    let r = exec(&client, &format!("SELECT event_type, COUNT(*) as cnt, AVG(status_code) as avg_st FROM {} GROUP BY event_type ORDER BY cnt DESC", TABLE)).await;
    let at = t4.elapsed();
    log!(
        "[AGGREGATION] {:.2?} | {} groups | {:.1}ms",
        at,
        r["rows"].as_array().map(|a| a.len()).unwrap_or(0),
        r["elapsed_ms"].as_f64().unwrap_or(0.0)
    );

    let t5 = Instant::now();
    let r = exec(
        &client,
        &format!("SELECT * FROM {} WHERE id = {}", TABLE, ROWS / 2),
    )
    .await;
    let pt = t5.elapsed();
    log!(
        "[POINT LOOKUP] {:.2?} | {} rows | {:.1}ms",
        pt,
        r["rows"].as_array().map(|a| a.len()).unwrap_or(0),
        r["elapsed_ms"].as_f64().unwrap_or(0.0)
    );

    let t6 = Instant::now();
    let r = exec(&client, &format!("SELECT zone, event_type, COUNT(*) as cnt FROM {} WHERE status_code >= 200 GROUP BY zone, event_type ORDER BY cnt DESC LIMIT 100", TABLE)).await;
    let cxt = t6.elapsed();
    log!(
        "[COMPLEX QUERY] {:.2?} | {} rows | {:.1}ms",
        cxt,
        r["rows"].as_array().map(|a| a.len()).unwrap_or(0),
        r["elapsed_ms"].as_f64().unwrap_or(0.0)
    );

    let total = t0.elapsed();
    log!("");
    log!("## Summary");
    log!(
        "Total time: {:.2?} | Rows: {} | Table: {}",
        total,
        ok,
        TABLE
    );
    log!("");
    log!("## Reference Comparison (public benchmarks, not measured by this tool)");
    log!("| Operation | HunTianDB (measured) | MySQL InnoDB | PostgreSQL | QuestDB |");
    log!("|-----------|---------------------|--------------|------------|---------|");
    log!("| CREATE TABLE | {:.2?} | ~50ms | ~30ms | ~20ms |", ct);
    log!(
        "| INSERT {} rows | {:.2?} ({:.0} r/s) | ~150K r/s | ~300K r/s | ~4-11M r/s |",
        ok,
        it,
        irate
    );
    log!(
        "| SELECT * LIMIT 10K | {:.2?} | ~200ms | ~150ms | ~50ms |",
        st
    );
    log!("| Aggregation | {:.2?} | ~500ms | ~300ms | ~20ms |", at);
    log!("| Point Lookup | {:.2?} | ~1ms | ~1ms | ~5ms |", pt);
    log!("| Complex Query | {:.2?} | ~800ms | ~500ms | ~100ms |", cxt);
    log!("");
    log!("**Note**: HunTianDB currently uses in-memory HashMap storage. QuestDB references are for ILP protocol. MySQL/PostgreSQL numbers are industry references for comparison.");

    std::fs::create_dir_all("benchmark/reports").ok();
    std::fs::write("benchmark/reports/benchmark_100k.md", &report).unwrap();
    println!("\nReport: benchmark/reports/benchmark_100k.md");
}
