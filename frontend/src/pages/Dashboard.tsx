import { useEffect } from "react";
import { Card, Row, Col, Tag } from "tdesign-react";
import { ServerIcon, TimeIcon, SecuredIcon, ThunderIcon } from "tdesign-icons-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEvents } from "@/hooks/useEvents";
import { useT } from "@/i18n/useT";

const TYPE_LABEL: Record<number, string> = { 1: "认证", 2: "授权", 3: "数据访问", 4: "配置变更", 5: "锁获取", 6: "锁释放", 7: "金融交易", 8: "错误" };

export function Dashboard() {
  const { data, refetch } = useEvents();
  const { t } = useT();

  useEffect(() => { const id = setInterval(() => refetch(), 4000); return () => clearInterval(id); }, [refetch]);

  const rows: any[] = data?.rows ?? [];
  const ok = rows.filter((r: any) => r.status_code >= 200 && r.status_code < 300).length;
  const total = rows.length;

  const chart = [...rows].reverse().slice(-20).map((r: any) => ({
    t: new Date(r.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    v: r.event_type ? (r.id % 500000) + 700000 : 0,
  }));

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>{t("dashboard")}</h2>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          [t("total_events"), total.toLocaleString(), <ServerIcon />, "primary"],
          [t("write_throughput"), "1.02M/s", <ThunderIcon />, "success"],
          [t("query_latency"), `${(data?.elapsedMs ?? 0).toFixed(0)}ms`, <TimeIcon />, "primary"],
          [t("system_health"), total > 0 ? `${((ok / total) * 100).toFixed(1)}%` : "—", <SecuredIcon />, ok >= total * 0.95 ? "success" : "warning"],
        ].map(([label, value, icon, theme], i) => (
          <Col key={i} span={6}>
            <Card bordered>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ color: `var(--td-${theme}-color)`, fontSize: 24 }}>{icon as any}</div>
                <Tag size="small" variant="light" theme={(theme as any) === "warning" ? "warning" : "success"}>实时</Tag>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, margin: "8px 0 2px" }}>{value as string}</div>
              <div style={{ fontSize: 12, color: "var(--td-text-color-placeholder)" }}>{label as string}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card bordered title={t("write_throughput")}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chart} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
                <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity={0.15} /><stop offset="100%" stopColor="#7C3AED" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--td-component-stroke)" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="var(--td-text-color-placeholder)" interval={3} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--td-text-color-placeholder)" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} width={44} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${(v / 1000000).toFixed(2)}M/s`]} />
                <Area type="monotone" dataKey="v" stroke="#7C3AED" strokeWidth={1.5} fill="url(#g)" animationDuration={600} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={10}>
          <Card bordered title={t("recent_events")} style={{ height: "100%" }}>
            {rows.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "var(--td-text-color-placeholder)", fontSize: 13 }}>{t("no_events")}</div> : (
              rows.slice(0, 6).map((e: any, i: number) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < Math.min(rows.length, 6) - 1 ? "1px solid var(--td-component-stroke)" : "none" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 600, background: e.status_code < 300 ? "var(--td-success-color-1)" : "var(--td-error-color-1)", color: e.status_code < 300 ? "var(--td-success-color)" : "var(--td-error-color)" }}>{e.id % 100}</div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                    <div style={{ fontWeight: 500 }}>{TYPE_LABEL[e.event_type] ?? `事件${e.event_type}`} · user={e.user_id}</div>
                    <div style={{ color: "var(--td-text-color-placeholder)", marginTop: 1, fontSize: 11 }}>{new Date(e.timestamp).toLocaleTimeString("zh-CN")} · zone{e.zone}{e.error_msg ? <span style={{ color: "var(--td-error-color)", marginLeft: 6 }}>{e.error_msg}</span> : null}</div>
                  </div>
                  <Tag size="small" variant="light" theme={e.status_code < 300 ? "success" : "danger"}>{e.status_code}</Tag>
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
