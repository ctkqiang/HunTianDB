// typescript/create_table.ts — 创建数据表
import { Client } from "pg";
async function main() {
  const c = new Client({ host: "127.0.0.1", port: 5408, user: "admin", password: "admin123", database: "huntiandb" });
  await c.connect();
  await c.query("DROP TABLE IF EXISTS security_events");
  await c.query(`CREATE TABLE security_events (id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL, user_id INT, session_id BIGINT, event_type SMALLINT, zone SMALLINT, status_code SMALLINT, ip_address INT, parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT)`);
  console.log("[OK] Table security_events created");
  const { rows } = await c.query("SHOW TABLES");
  rows.forEach((r: any) => console.log(`  ${r.table_name}`));
  await c.end(); console.log("[DONE]");
}
main().catch(console.error);
