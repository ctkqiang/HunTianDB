// rust/query_data.rs — 查询与聚合
use std::process::Command;
fn main() {
    for (label, sql) in [
        ("COUNT(*)", "SELECT COUNT(*) FROM security_events"),
        ("SUM", "SELECT SUM(status_code) FROM security_events"),
        ("AVG", "SELECT AVG(status_code) FROM security_events"),
        ("GROUP BY", "SELECT event_type, COUNT(*) FROM security_events GROUP BY event_type ORDER BY COUNT(*) DESC"),
    ] {
        let out = Command::new("psql").args(["-h","127.0.0.1","-p","5408","-U","admin","-d","huntiandb","-c",sql]).env("PGPASSWORD","admin123").output().unwrap();
        let lines: Vec<&str> = String::from_utf8_lossy(&out.stdout).lines().collect();
        println!("[OK] {}: {} rows", label, lines.len().saturating_sub(3));
    }
    println!("[DONE]");
}
