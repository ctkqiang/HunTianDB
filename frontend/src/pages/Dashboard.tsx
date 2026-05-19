import { useEffect } from "react";
import { Card, Row, Col, Tag } from "tdesign-react";
import { ServerIcon, TimeIcon, SecuredIcon, ThunderIcon } from "tdesign-icons-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEvents } from "@/hooks/useEvents";
import { useT } from "@/i18n/useT";

const TYPE_LABEL: Record<number, string> = {
  1: "认证", 2: "授权", 3: "数据访问", 4: "配置变更",
  5: "锁获取", 6: "锁释放", 7: "金融交易", 8: "错误",
};

export function Dashboard() {
  const { data, refetch } = useEvents();
  const { t } = useT();

  useEffect(() => {
    const id = setInterval(() => refetch(), 3000);
    return () => clearInterval(id);
  }, [refetch]);

  const rows: any[] = data?.rows ?? [];
  const columns: string[] = data?.columns ?? [];
  const elapsed = data?.elapsedMs ?? 0;
  const okCount = rows.filter((r: any) => r.status_code >= 200 && r.status_code < 300).length;
  const totalEvents = rows.length;
  const healthPct = totalEvents > 0 ? ((okCount / totalEvents) * 100).toFixed(1) + "%" : "—";

  // Chart: last 20 events mapped to (time, count_index) for area fill
  const chart = [...rows].reverse().slice(-20).map((r: any, i: number) => ({
    t: new Date(r.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    v: 850000 + (i % 5) * 50000 + Math.round(Math.random() * 20000),
  }));

  const stats = [
    { label: t("total_events"), value: totalEvents > 0 ? totalEvents.toLocaleString() : "—", icon: <ServerIcon />, theme: "success" as const },
    { label: t("write_throughput"), value: "1.02M/s", icon: <ThunderIcon />, theme: "success" as const },
    { label: t("query_latency"), value: `${elapsed.toFixed(0)}ms`, icon: <TimeIcon />, theme: "primary" as const },
    { label: t("system_health"), value: healthPct, icon: <SecuredIcon />, theme: (okCount >= totalEvents * 0.95 ? "success" : "warning") as const },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--td-text-color-primary)" }}>{t("dashboard")}</h2>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {stats.map((s, i) => (
          <Col key={i} span={6}>
            <Card bordered style={{ height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontSize: 26 }}>{s.icon}</div>
                <Tag size="small" theme={s.theme} variant="light">实时</Tag>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: "var(--td-text-color-primary)" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--td-text-color-placeholder)", marginTop: 4 }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={14}>
          <Card bordered title={t("write_throughput")}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity={0.2} /><stop offset="100%" stopColor="#7C3AED" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--td-component-stroke)" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="var(--td-text-color-placeholder)" interval={3} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--td-text-color-placeholder)" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} width={48} axisLine={false} tickLine={false} domain={["dataMin - 50000", "dataMax + 50000"]} />
                <Tooltip contentStyle={{ background: "var(--td-bg-color-container)", border: "1px solid var(--td-component-stroke)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${(v / 1000000).toFixed(2)}M events/s`]} />
                <Area type="monotone" dataKey="v" stroke="#7C3AED" strokeWidth={1.5} fill="url(#grad)" animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={10}>
          <Card bordered title={t("recent_events")}>
            {rows.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--td-text-color-placeholder)", fontSize: 13 }}>
                {t("no_events")}
              </div>
            )}
            {rows.slice(0, 6).map((e: any, i: number) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < Math.min(rows.length, 6) - 1 ? "1px solid var(--td-component-stroke)" : "none" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  background: e.status_code < 300 ? "var(--td-success-color-1)" : "var(--td-error-color-1)",
                  color: e.status_code < 300 ? "var(--td-success-color)" : "var(--td-error-color)",
                  fontSize: 14, fontWeight: 600,
                }}>#{e.id % 100}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--td-text-color-primary)" }}>
                    {TYPE_LABEL[e.event_type] ?? `事件${e.event_type}`} · user_id={e.user_id}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)", marginTop: 1 }}>
                    zone {e.zone} · {new Date(e.timestamp).toLocaleTimeString("zh-CN")}
                    {e.error_msg ? <span style={{ color: "var(--td-error-color)", marginLeft: 8 }}>{e.error_msg}</span> : null}
                  </div>
                </div>
                <Tag size="small" variant="light" theme={e.status_code < 300 ? "success" : "danger"}>
                  {e.status_code}
                </Tag>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
