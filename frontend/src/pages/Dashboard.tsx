import { Card, Row, Col, Tag } from "tdesign-react";
import { ChartLineIcon, ServerIcon, TimeIcon, SecuredIcon, ThunderIcon } from "tdesign-icons-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEvents } from "@/hooks/useEvents";
import { useT } from "@/i18n/useT";

const mockThroughput = [
  { time: "14:00", eps: 850000 }, { time: "14:05", eps: 920000 }, { time: "14:10", eps: 880000 },
  { time: "14:15", eps: 950000 }, { time: "14:20", eps: 1020000 }, { time: "14:25", eps: 980000 },
  { time: "14:30", eps: 1050000 }, { time: "14:35", eps: 990000 }, { time: "14:40", eps: 1100000 },
  { time: "14:45", eps: 1080000 }, { time: "14:50", eps: 1150000 }, { time: "14:55", eps: 1200000 },
];

const recentEvents = [
  { id: 1042, user: "admin", type: "auth", status: "ok", time: "14:55:32", zone: 3 },
  { id: 1041, user: "auditor_7", type: "data_access", status: "ok", time: "14:55:28", zone: 1 },
  { id: 1040, user: "writer_3", type: "lock_acquire", status: "ok", time: "14:55:15", zone: 2 },
  { id: 1039, user: "reader_12", type: "config_change", status: "denied", time: "14:54:58", zone: 1 },
  { id: 1038, user: "admin", type: "authorize", status: "ok", time: "14:54:40", zone: 3 },
];

export function Dashboard() {
  const { isLoading } = useEvents();
  const { t } = useT();

  const stats = [
    { label: t("total_events"), value: "2.4M", icon: <ServerIcon />, trend: "+12%", color: "#7C3AED" },
    { label: t("write_throughput"), value: "1.02M/s", icon: <ThunderIcon />, trend: "+8%", color: "#059669" },
    { label: t("query_latency"), value: "12ms", icon: <TimeIcon />, trend: "-15%", color: "#2563EB" },
    { label: t("system_health"), value: "99.99%", icon: <SecuredIcon />, trend: t("healthy"), color: "#0891B2" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--td-text-color-primary)" }}>{t("dashboard")}</h2>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--td-text-color-placeholder)" }}>{t("app_desc")}</p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {stats.map((s, i) => (
          <Col key={i} span={6}>
            <Card bordered style={{ height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontSize: 26, color: s.color }}>{s.icon}</div>
                <Tag size="small" theme={s.trend.startsWith("+") ? "warning" : "success"} variant="light">{s.trend}</Tag>
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
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={mockThroughput}>
                <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity={0.3} /><stop offset="100%" stopColor="#7C3AED" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--td-component-stroke)" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="var(--td-text-color-placeholder)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--td-text-color-placeholder)" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip contentStyle={{ background: "var(--td-bg-color-container)", border: "1px solid var(--td-component-stroke)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="eps" stroke="#7C3AED" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={10}>
          <Card bordered title={t("recent_events")}>
            <div style={{ maxHeight: 280, overflow: "auto" }}>
              {recentEvents.map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--td-component-stroke)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Tag size="small" variant="light" theme={e.status === "ok" ? "success" : "danger"}>{e.status}</Tag>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--td-text-color-primary)" }}>#{e.id} · {e.type}</div>
                      <div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)" }}>{e.user} · zone {e.zone}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--td-text-color-placeholder)" }}>{e.time}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
