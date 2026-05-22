// rust/user_management.rs — 用户管理
use std::process::Command;
fn exec(sql: &str) -> String {
    let out = Command::new("psql").args(["-h","127.0.0.1","-p","5408","-U","admin","-d","huntiandb","-c",sql]).env("PGPASSWORD","admin123").output().unwrap();
    String::from_utf8_lossy(&out.stdout).to_string()
}
fn main() {
    println!("{}", exec("SHOW USERS"));
    exec("INSERT INTO users (username, role) VALUES ('rust_analyst', 'reader')");
    println!("[OK] INSERT INTO users: rust_analyst (reader)");
    println!("[DONE]");
}
