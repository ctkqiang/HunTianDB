// rust/main.rs — 混天DB Rust 使用示例
//
// 依赖 (Cargo.toml):
//   [dependencies]
//   tokio = { version = "1", features = ["full"] }
//   tokio-postgres = "0.7"
//
// 运行: cargo run

use tokio_postgres::{NoTls, Error};

#[tokio::main]
async fn main() -> Result<(), Error> {
    let conn_str = "host=127.0.0.1 port=5408 user=admin password=admin123 dbname=huntiandb";
    let (client, connection) = tokio_postgres::connect(conn_str, NoTls).await?;

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("连接错误: {}", e);
        }
    });

    println!("[OK] 已连接混天DB");

    // 创建表
    client.batch_execute("
        CREATE TABLE IF NOT EXISTS rust_events (
            id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL,
            event_type SMALLINT, status_code SMALLINT, payload TEXT
        )
    ").await?;
    println!("[OK] 表 rust_events 已创建");

    // 批量插入
    let rows = 500;
    let start = std::time::Instant::now();
    for b in (0..rows).step_by(100) {
        let mut vals: Vec<String> = Vec::new();
        for i in b..std::cmp::min(b + 100, rows) {
            vals.push(format!(
                "({},{},{},{},'rust_payload_{}')",
                i, 1779200000000i64 + i as i64 * 1000, i as i64 % 8 + 1, 200, i
            ));
        }
        client.execute(
            &format!("INSERT INTO rust_events VALUES {}", vals.join(",")),
            &[],
        ).await?;
    }
    println!("[OK] INSERT {} rows: {:?}", rows, start.elapsed());

    // 查询
    let count: tokio_postgres::Row = client.query_one(
        "SELECT COUNT(*) FROM rust_events", &[],
    ).await?;
    let cnt: i64 = count.get(0);
    println!("[OK] COUNT(*) = {}", cnt);

    let agg = client.query(
        "SELECT event_type, COUNT(*) as cnt FROM rust_events GROUP BY event_type ORDER BY cnt DESC",
        &[],
    ).await?;
    println!("GROUP BY 结果:");
    for row in agg {
        let etype: i16 = row.get(0);
        let cnt: i64 = row.get(1);
        println!("  type={} count={}", etype, cnt);
    }

    println!("\n[DONE]");
    Ok(())
}
