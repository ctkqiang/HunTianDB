// typescript/data_insert_totable.ts — 批量插入数据
import { Client } from "pg";
async function main() {
  const ROWS = parseInt(process.argv[2] || "1000");
  const BATCH = parseInt(process.argv[3] || "500");
  const c = new Client({ host: "127.0.0.1", port: 5408, user: "admin", password: "admin123", database: "huntiandb" });
  await c.connect();
  await c.query("DROP TABLE IF EXISTS security_events");
  await c.query(`CREATE TABLE security_events (id BIGINT PRIMARY KEY, timestamp BIGINT NOT NULL, user_id INT, session_id BIGINT, event_type SMALLINT, zone SMALLINT, status_code SMALLINT, ip_address INT, parent_event_id BIGINT, error_msg VARCHAR(256), payload TEXT)`);
  const PAYLOAD = "SEC_AUDIT_".repeat(60);
  const t0 = Date.now();
  for (let b = 0; b < ROWS; b += BATCH) {
    const v: string[] = [];
    const end = Math.min(b + BATCH, ROWS);
    for (let i = b; i < end; i++) v.push(`(${i},${1779200000000+i*1000},${i%500},${i*13},${i%8+1},${i%5+1},200,${0x0A000001+(i%255)},${i-1||0},'OK','${PAYLOAD}')`);
    await c.query(`INSERT INTO security_events VALUES ${v.join(",")}`);
  }
  const elapsed = (Date.now() - t0) / 1000;
  console.log(`[OK] ${ROWS} rows in ${elapsed.toFixed(2)}s (${Math.round(ROWS/elapsed)} r/s)`);
  const { rows: [r] } = await c.query("SELECT COUNT(*) FROM security_events");
  console.log(`[OK] COUNT(*) = ${(r as any).count}`);
  await c.end(); console.log("[DONE]");
}
main().catch(console.error);
