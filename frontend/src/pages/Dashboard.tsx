import { useState, useEffect, useCallback } from "react";
import { Card, Row, Col, Tag } from "tdesign-react";
import { ChartLineIcon, ServerIcon, TimeIcon, SecuredIcon, ThunderIcon } from "tdesign-icons-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEvents } from "@/hooks/useEvents";
import { useT } from "@/i18n/useT";

const SEED = [
  { t: "14:00", eps: 856320 }, { t: "14:01", eps: 892100 }, { t: "14:02", eps: 934500 },
  { t: "14:03", eps: 910200 }, { t: "14:04", eps: 887600 }, { t: "14:05", eps: 951400 },
  { t: "14:06", eps: 978300 }, { t: "14:07", eps: 1020500 }, { t: "14:08", eps: 996800 },
  { t: "14:09", eps: 1043200 }, { t: "14:10", eps: 1010800 }, { t: "14:11", eps: 987500 },
  { t: "14:12", eps: 1056700 }, { t: "14:13", eps: 1089200 }, { t: "14:14", eps: 1103400 },
  { t: "14:15", eps: 1078000 }, { t: "14:16", eps: 1125600 }, { t: "14:17", eps: 1150000 },
  { t: "14:18", eps: 1182300 }, { t: "14:19", eps: 1201000 },
];

const recentBase = [
  { id: 1042, user: "admin", type: "认证", ok: true, time: "14:55:32", zone: 3 },
  { id: 1041, user: "auditor_7", type: "数据访问", ok: true, time: "14:55:28", zone: 1 },
  { id: 1040, user: "writer_3", type: "锁获取", ok: true, time: "14:55:15", zone: 2 },
  { id: 1039, user: "reader_12", type: "配置变更", ok: false, time: "14:54:58", zone: 1 },
  { id: 1038, user: "admin", type: "授权", ok: true, time: "14:54:40", zone: 3 },
  { id: 1037, user: "writer_5", type: "金融交易", ok: true, time: "14:54:22", zone: 2 },
];

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export function Dashboard() {
  const { isLoading } = useEvents();
  const { t } = useT();
  const [data, setData] = useState(SEED);
  const [events, setEvents] = useState(recentBase);
  const [kpi, setKpi] = useState({ eps: 1.02, total: 2.4, latency: 12 });

  // 实时数据流 — 每2秒滚动一个数据点
  useEffect(() => {
    const tick = setInterval(() => {
      setData((prev) => {
        const last = prev[prev.length - 1];
        const noise = (Math.random() - 0.5) * 120000;
        const nextEps = Math.max(800000, Math.min(1300000, last.eps + noise));
        const next = [...prev.slice(1), { t: nowTime(), eps: Math.round(nextEps) }];
        return next;
      });
      setKpi({
        eps: Math.round((0.85 + Math.random() * 0.4) * 100) / 100,
        total: Math.round(2.4 + Math.random() * 0.2),
        latency: Math.round(8 + Math.random() * 10),
      });
      setEvents((prev) => {
        const id = prev[0].id + 1;
        const types = ["认证", "数据访问", "锁获取", "授权", "金融交易"];
        const users = ["admin", "auditor_3", "writer_7", "reader_12", "writer_5"];
        const n: typeof prev[0] = {
          id, user: users[Math.floor(Math.random() * users.length)],
          type: types[Math.floor(Math.random() * types.length)],
          ok: Math.random() > 0.15, time: nowTime(), zone: Math.ceil(Math.random() * 5),
        };
        return [n, ...prev.slice(0, 5)];
      });
    }, 2000);
    return () => clearInterval(tick);
  }, []);

  const stats = [
    { label: t("total_events"), value: `${kpi.total}M`, icon: <ServerIcon />, trend: "+12%", up: true },
    { label: t("write_throughput"), value: `${kpi.eps}M/s`, icon: <ThunderIcon />, trend: "实时", up: true },
    { label: t("query_latency"), value: `${kpi.latency}ms`, icon: <TimeIcon />, trend: "实时", up: false },
    { label: t("system_health"), value: "99.99%", icon: <SecuredIcon />, trend: t("healthy"), up: true },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--td-text-color-primary)" }}>{t("dashboard")}</h2>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {stats.map((s, i) => (
          <Col key={i} span={6}>
            <Card bordered style={{ height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontSize: 26, color: s.color }}>{s.icon}</div>
                <Tag size="small" theme={s.up ? "success" : "primary"} variant="light">{s.trend}</Tag>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: "var(--td-text-color-primary)" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--td-text-color-placeholder)", marginTop: 4 }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={14}>
          <Card bordered title={<span>{t("write_throughput")} <Tag size="small" theme="success" variant="light">● 实时</Tag></span>}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity={0.2} /><stop offset="100%" stopColor="#7C3AED" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--td-component-stroke)" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="var(--td-text-color-placeholder)" interval={3} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--td-text-color-placeholder)" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} width={48} axisLine={false} tickLine={false} domain={["dataMin - 50000", "dataMax + 50000"]} />
                <Tooltip contentStyle={{ background: "var(--td-bg-color-container)", border: "1px solid var(--td-component-stroke)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${(v / 1000000).toFixed(2)}M events/s`, t("write_throughput")]} />
                <Area type="monotone" dataKey="eps" stroke="#7C3AED" strokeWidth={1.5} fill="url(#grad)" animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={10}>
          <Card bordered title={<span>{t("recent_events")} <Tag size="small" theme="success" variant="light">● 实时</Tag></span>}>
            {events.map((e, i) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < events.length - 1 ? "1px solid var(--td-component-stroke)" : "none" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  background: e.ok ? "var(--td-success-color-1)" : "var(--td-error-color-1)",
                  color: e.ok ? "var(--td-success-color)" : "var(--td-error-color)", fontSize: 14, fontWeight: 600, flexShrink: 0,
                }}>#{e.id % 100}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--td-text-color-primary)" }}>{e.type}</div>
                  <div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)", marginTop: 1 }}>{e.user} · 分区{e.zone} · {e.time}</div>
                </div>
                <Tag size="small" variant="light" theme={e.ok ? "success" : "danger"}>{e.ok ? "通过" : "拒绝"}</Tag>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* 吞吐量详细统计 */}
      {(() => {
        const vals = data.map((d) => d.eps);
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const diffs = vals.map((v) => (v - avg) ** 2);
        const std = Math.sqrt(diffs.reduce((a, b) => a + b, 0) / vals.length);
        const rows = [
          ["当前", `${(vals[vals.length - 1] / 1000000).toFixed(2)} M/s`, "success"],
          ["平均", `${(avg / 1000000).toFixed(2)} M/s`, "primary"],
          ["峰值", `${(max / 1000000).toFixed(2)} M/s`, "warning"],
          ["谷值", `${(min / 1000000).toFixed(2)} M/s`, "default"],
          ["波动", `±${(std / 1000000).toFixed(2)} M/s`, "default"],
          ["窗口", `${vals.length} 点 (${(vals.length / 60).toFixed(0)}分钟)`, "default"],
        ];
        return (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={14}>
              <Card bordered title={t("write_throughput") + " 数据概览"}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {rows.map(([label, value, theme]) => (
                    <div key={label as string} style={{ padding: "10px 14px", borderRadius: 8, background: "var(--td-bg-color-component)" }}>
                      <div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)", marginBottom: 4 }}>{label}</div>
                      <Tag size="medium" theme={theme as any} variant="light">{value}</Tag>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
          </Row>
        );
      })()}
    </div>
  );
}
