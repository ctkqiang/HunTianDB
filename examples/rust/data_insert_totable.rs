// rust/data_insert_totable.rs — 批量插入
use std::env; use std::process::Command; use std::time::Instant;
fn main() {
    let args: Vec<String> = env::args().collect();
    let rows: usize = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(1000);
    let batch: usize = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(500);
    let payload = "SEC_AUDIT_".repeat(20);
    let t0 = Instant::now();
    for b in (0..rows).step_by(batch) {
        let end = std::cmp::min(b+batch, rows);
        let vals: Vec<String> = (b..end).map(|i| format!("({},{},{},{},{},{},{},{},{},'OK','{}')", i, 1779200000000u64+i as u64*1000, i%500, i*13, i%8+1, i%5+1, 200, 0x0A000001u64+(i%255) as u64, i.saturating_sub(1), payload)).collect();
        let sql = format!("INSERT INTO security_events VALUES {}", vals.join(","));
        Command::new("psql").args(["-h","127.0.0.1","-p","5408","-U","admin","-d","huntiandb","-c",&sql]).env("PGPASSWORD","admin123").output().unwrap();
    }
    let elapsed = t0.elapsed().as_secs_f64();
    println!("[OK] {} rows in {:.2}s ({:.0} r/s)", rows, elapsed, rows as f64/elapsed);
    println!("[DONE]");
}
