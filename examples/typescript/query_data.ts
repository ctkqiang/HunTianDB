// typescript/query_data.ts — 查询与聚合
import { Client } from "pg";
async function main() {
  const c = new Client({ host: "127.0.0.1", port: 5408, user: "admin", password: "admin123", database: "huntiandb" });
  await c.connect();
  const tests: [string, string][] = [["COUNT(*)", "SELECT COUNT(*) FROM security_events"], ["Point Lookup", "SELECT * FROM security_events WHERE id = 5000"], ["Range Scan", "SELECT * FROM security_events WHERE id BETWEEN 100 AND 200"], ["SUM", "SELECT SUM(status_code) FROM security_events"], ["AVG", "SELECT AVG(status_code) FROM security_events"], ["GROUP BY", "SELECT event_type, COUNT(*) FROM security_events GROUP BY event_type ORDER BY COUNT(*) DESC"]];
  for (const [label, sql] of tests) {
    const t0 = Date.now();
    const { rows } = await c.query(sql);
    console.log(`[OK] ${label}: ${rows.length} rows (${(Date.now()-t0).toFixed(1)}ms)`);
  }
  await c.end(); console.log("[DONE]");
}
main().catch(console.error);
