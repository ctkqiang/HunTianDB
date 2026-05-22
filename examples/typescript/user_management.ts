// typescript/user_management.ts — 用户管理
import { Client } from "pg";
async function main() {
  const c = new Client({ host: "127.0.0.1", port: 5408, user: "admin", password: "admin123", database: "huntiandb" });
  await c.connect();
  const { rows: users } = await c.query("SHOW USERS");
  console.log("── Current Users ──");
  users.forEach((r: any) => console.log(`  ${r.username} (${r.role})`));
  await c.query("INSERT INTO users (username, password, role) VALUES ('ts_analyst', 'secure789', 'reader')");
  console.log("[OK] INSERT INTO users: ts_analyst (reader)");
  await c.query("CREATE USER ts_auditor 'audit456' writer");
  console.log("[OK] CREATE USER: ts_auditor (writer)");
  await c.end(); console.log("[DONE]");
}
main().catch(console.error);
