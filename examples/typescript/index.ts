/**
 * typescript/index.ts — 混天DB TypeScript 使用示例
 *
 * 依赖: npm install pg
 * 运行: npx tsx index.ts
 */

import { Client } from "pg";

const client = new Client({
  host: "127.0.0.1",
  port: 5408,
  user: "admin",
  password: "admin123",
  database: "huntiandb",
});

async function main() {
  await client.connect();
  console.log("[OK] 已连接混天DB\n");

  // ── 创建表 ──
  await client.query(`
    CREATE TABLE IF NOT EXISTS ts_events (
      id BIGINT PRIMARY KEY,
      timestamp BIGINT NOT NULL,
      event_type SMALLINT,
      status_code SMALLINT,
      payload TEXT
    )
  `);
  console.log("[OK] 表 ts_events 已创建");

  // ── 批量插入 ──
  const ROWS = 1000;
  console.time("INSERT");
  for (let b = 0; b < ROWS; b += 200) {
    const vals: string[] = [];
    for (let i = b; i < Math.min(b + 200, ROWS); i++) {
      vals.push(
        `(${i},${1779200000000 + i * 1000},${(i % 8) + 1},${200},'ts_payload_${i}')`
      );
    }
    await client.query(`INSERT INTO ts_events VALUES ${vals.join(",")}`);
  }
  console.timeEnd("INSERT");

  // ── 查询 ──
  const { rows: countRows } = await client.query("SELECT COUNT(*) FROM ts_events");
  console.log(`[OK] COUNT(*) = ${countRows[0].count}`);

  const { rows } = await client.query(
    "SELECT event_type, COUNT(*) as cnt FROM ts_events GROUP BY event_type ORDER BY cnt DESC"
  );
  console.log("GROUP BY 结果:");
  rows.forEach((r) => console.log(`  type=${r.event_type} count=${r.cnt}`));

  await client.end();
  console.log("\n[DONE]");
}

main().catch(console.error);
