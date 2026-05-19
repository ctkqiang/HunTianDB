import { Card, Row, Col, Tag, Loading, Progress, Space, Tooltip } from "tdesign-react";
import { ChartLineIcon, ServerIcon, TimeIcon, CheckCircleIcon, ErrorCircleIcon, LayersIcon, ThunderIcon, ShieldIcon } from "tdesign-icons-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { useEvents } from "@/hooks/useEvents";

const mockThroughput = [
  { time: "14:00", eps: 850000 }, { time: "14:05", eps: 920000 }, { time: "14:10", eps: 880000 },
  { time: "14:15", eps: 950000 }, { time: "14:20", eps: 1020000 }, { time: "14:25", eps: 980000 },
  { time: "14:30", eps: 1050000 }, { time: "14:35", eps: 990000 }, { time: "14:40", eps: 1100000 },
  { time: "14:45", eps: 1080000 }, { time: "14:50", eps: 1150000 }, { time: "14:55", eps: 1200000 },
];

const mockLatency = [
  { time: "14:00", p50: 3, p95: 12, p99: 25 }, { time: "14:10", p50: 4, p95: 15, p99: 30 },
  { time: "14:20", p50: 3, p95: 11, p99: 22 }, { time: "14:30", p50: 5, p95: 18, p99: 35 },
  { time: "14:40", p50: 4, p95: 14, p99: 28 }, { time: "14:50", p50: 3, p95: 10, p99: 20 },
];

const recentEvents = [
  { id: 1042, user: "admin", type: "认证", status: "成功", time: "14:55:32", zone: 3 },
  { id: 1041, user: "auditor_7", type: "数据访问", status: "成功", time: "14:55:28", zone: 1 },
  { id: 1040, user: "writer_3", type: "锁获取", status: "成功", time: "14:55:15", zone: 2 },
  { id: 1039, user: "reader_12", type: "配置变更", status: "拒绝", time: "14:54:58", zone: 1 },
  { id: 1038, user: "admin", type: "授权", status: "成功", time: "14:54:40", zone: 3 },
];

export function Dashboard() {
  const { data, isLoading } = useEvents();

  const stats = [
    { label: "事件总写入量", value: "2.4M", icon: <ServerIcon />, trend: "+12%", color: "#7C3AED" },
    { label: "写入吞吐", value: "1.02M/s", icon: <ThunderIcon />, trend: "+8%", color: "#059669" },
    { label: "查询延迟 P95", value: "12ms", icon: <TimeIcon />, trend: "-15%", color: "#2563EB" },
    { label: "系统健康", value: "99.99%", icon: <ShieldIcon />, trend: "正常", color: "#0891B2" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>系统概览</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--td-text-color-placeholder)" }}>实时监控混天DB集群运行状态</p>
        </div>
        <Tag theme="success" variant="light" size="medium">● 在线 · v1.0.0</Tag>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {stats.map((s, i) => (
          <Col key={i} span={6}>
            <Card bordered style={{ height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontSize: 28, color: s.color }}>{s.icon}</div>
                <Tag size="small" theme={s.trend.startsWith("+") ? "warning" : s.trend === "正常" ? "success" : "success"} variant="light">{s.trend}</Tag>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--td-text-color-placeholder)", marginTop: 4 }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={14}>
          <Card bordered title="写入吞吐量" actions={<Tag size="small" variant="light" theme="primary">实时</Tag>}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={mockThroughput}>
                <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity={0.3} /><stop offset="100%" stopColor="#7C3AED" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--td-component-stroke)" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="var(--td-text-color-placeholder)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--td-text-color-placeholder)" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <ReTooltip contentStyle={{ background: "var(--td-bg-color-container)", border: "1px solid var(--td-component-stroke)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="eps" stroke="#7C3AED" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={10}>
          <Card bordered title="最近安全事件" actions={<Tag size="small" variant="light" theme="primary">实时</Tag>}>
            <div style={{ maxHeight: 280, overflow: "auto" }}>
              {recentEvents.map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--td-component-stroke)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Tag size="small" variant="light" theme={e.status === "成功" ? "success" : "danger"}>{e.status}</Tag>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>#{e.id} · {e.type}</div>
                      <div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)" }}>{e.user} · 分区{e.zone}</div>
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
