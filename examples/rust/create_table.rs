// rust/create_table.rs — 创建数据表
// 运行: rustc create_table.rs && ./create_table (或 cargo script)
use std::process::Command;
fn main() {
    let sql = "DROP TABLE IF EXISTS security_events; CREATE TABLE security_events (id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL, user_id INT, session_id BIGINT, event_type SMALLINT, zone SMALLINT, status_code SMALLINT, ip_address INT, parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT); SHOW TABLES;";
    let output = Command::new("psql").args(["-h","127.0.0.1","-p","5408","-U","admin","-d","huntiandb","-c",sql]).env("PGPASSWORD","admin123").output().unwrap();
    println!("{}", String::from_utf8_lossy(&output.stdout));
    println!("[DONE]");
}
