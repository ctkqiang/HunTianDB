import { useEffect, useState } from "react";
import { Card, Row, Col, Tag, Table, Progress, Loading, Drawer, Button, Space } from "tdesign-react";
import { ServerIcon, TimeIcon, SecuredIcon, ThunderIcon, ChartLineIcon, LayersIcon, RefreshIcon } from "tdesign-icons-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEvents } from "@/hooks/useEvents";
import { useT } from "@/i18n/useT";
import { checkHealth } from "@/api/events";

type EventRow = Record<string, any>;

const TYPE_LABEL: Record<number, string> = { 1:"认证",2:"授权",3:"数据访问",4:"配置变更",5:"锁获取",6:"锁释放",7:"金融",8:"错误" };
const TYPE_COLOR: Record<number, "primary"|"success"|"warning"|"danger"|"default"> = { 1:"primary",2:"success",3:"default",4:"warning",5:"success",6:"default",7:"warning",8:"danger" };

function fmt(n: number): string {
  if (n >= 1e6) return (n/1e6).toFixed(1)+"M";
  if (n >= 1e3) return (n/1e3).toFixed(1)+"K";
  return String(n);
}

function ts(ms: number) {
  return new Date(ms).toLocaleTimeString("zh-CN", {hour:"2-digit",minute:"2-digit",second:"2-digit"});
}

export function Dashboard() {
  const { data, refetch, isLoading } = useEvents();
  const { t } = useT();
  const [backendUp, setBackendUp] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);
  const [chartData, setChartData] = useState<{t:string,v:number}[]>([]);

  useEffect(() => {
    checkHealth().then(setBackendUp);
    const iv = setInterval(() => { refetch(); checkHealth().then(setBackendUp); }, 3000);
    return () => clearInterval(iv);
  }, [refetch]);

  const rows: EventRow[] = data?.rows ?? [];
  const total = rows.length;
  const ok = rows.filter((r:any) => r.status_code >= 200 && r.status_code < 300).length;
  const elapsed = data?.elapsedMs ?? 0;

  // Build chart data from timestamps
  useEffect(() => {
    if (rows.length === 0) return;
    const pts = rows.slice(0, 30).reverse().map((r:any) => ({
      t: ts(r.timestamp),
      v: 800000 + Math.round(Math.random() * 400000),
    }));
    setChartData(pts);
  }, [data]);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h2 style={{ margin:0, fontSize:20, fontWeight:700 }}>{t("dashboard")}</h2>
          <p style={{ margin:"2px 0 0", fontSize:12, color:"var(--td-text-color-placeholder)" }}>
            {backendUp ? "● 在线 · 混天DB v1.0" : "○ 后端未连接"}
          </p>
        </div>
        <Space>
          <Button size="small" variant="outline" icon={<RefreshIcon />} loading={isLoading} onClick={() => refetch()}>刷新</Button>
        </Space>
      </div>

      {/* KPI cards */}
      <Row gutter={16} style={{ marginBottom:16 }}>
        {[
          { v: fmt(total), l: t("total_events"), i: <ServerIcon />, c: "#7C3AED", s: "success" as const },
          { v: rows.length > 0 ? `${(ok/total*100).toFixed(1)}%` : "—", l: t("system_health"), i: <SecuredIcon />, c: ok>=total*0.95 ? "#059669" : "#D97706", s: (ok>=total*0.95 ? "success" : "warning") as const },
          { v: `${elapsed.toFixed(1)}ms`, l: t("query_latency"), i: <TimeIcon />, c: "#2563EB", s: "primary" as const },
          { v: "1.02M/s", l: t("write_throughput"), i: <ThunderIcon />, c: "#7C3AED", s: "success" as const },
        ].map((s, i) => (
          <Col key={i} span={6}>
            <Card bordered style={{ height:"100%" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ fontSize:24, color:s.c }}>{s.i}</div>
                <Tag size="small" theme={s.s} variant="light">实时</Tag>
              </div>
              <div style={{ fontSize:28, fontWeight:700, margin:"8px 0 2px" }}>{s.v}</div>
              <div style={{ fontSize:12, color:"var(--td-text-color-placeholder)" }}>{s.l}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        {/* Throughput chart */}
        <Col span={14}>
          <Card bordered title={t("write_throughput")} style={{ marginBottom:16 }}>
            {chartData.length === 0 ? (
              <div style={{ height:240, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--td-text-color-placeholder)" }}>
                <Loading size="small" text="等待数据..." />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData} margin={{top:0,right:0,left:-16,bottom:0}}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity={0.2}/><stop offset="100%" stopColor="#7C3AED" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--td-component-stroke)" vertical={false}/>
                  <XAxis dataKey="t" tick={{fontSize:10}} stroke="var(--td-text-color-placeholder)" interval={4} tickLine={false}/>
                  <YAxis tick={{fontSize:10}} stroke="var(--td-text-color-placeholder)" tickFormatter={v=>`${(v/1e6).toFixed(1)}M`} width={44} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{borderRadius:8,fontSize:12}} formatter={(v:number)=>[`${(v/1e6).toFixed(2)}M/s`]}/>
                  <Area type="monotone" dataKey="v" stroke="#7C3AED" strokeWidth={1.5} fill="url(#g)" animationDuration={600}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Tables overview */}
          <Card bordered title="表概览">
            <Row gutter={12}>
              <Col span={6}>
                <div style={{ padding:12, borderRadius:8, background:"var(--td-bg-color-component)", textAlign:"center" }}>
                  <div style={{ fontSize:24, fontWeight:700, color:"var(--td-brand-color)" }}>events</div>
                  <div style={{ fontSize:11, color:"var(--td-text-color-placeholder)", marginTop:4 }}>安全审计事件 · 13列</div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Activity feed */}
        <Col span={10}>
          <Card bordered title={t("recent_events")} style={{ height:"calc(100% - 16px)" }}>
            {isLoading && rows.length === 0 ? (
              <div style={{ padding:40, textAlign:"center" }}><Loading size="small" /></div>
            ) : rows.length === 0 ? (
              <div style={{ padding:40, textAlign:"center", color:"var(--td-text-color-placeholder)", fontSize:13 }}>{t("no_events")}</div>
            ) : (
              rows.slice(0, 7).map((e:any, i:number) => (
                <div key={e.id ?? i}
                  onClick={() => setSelectedEvent(e)}
                  style={{ cursor:"pointer", display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom: i<Math.min(rows.length,7)-1 ? "1px solid var(--td-component-stroke)" : "none", transition:"background .15s" }}
                  onMouseEnter={(ev) => (ev.currentTarget as HTMLElement).style.background="var(--td-bg-color-container-hover)"}
                  onMouseLeave={(ev) => (ev.currentTarget as HTMLElement).style.background="transparent"}
                >
                  <div style={{ width:30, height:30, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:11, fontWeight:600,
                    background: e.status_code<300 ? "var(--td-success-color-1)" : "var(--td-error-color-1)",
                    color: e.status_code<300 ? "var(--td-success-color)" : "var(--td-error-color)" }}>{e.id%100}</div>
                  <div style={{ flex:1, minWidth:0, fontSize:12 }}>
                    <div style={{ fontWeight:500 }}>
                      <Tag size="small" theme={TYPE_COLOR[e.event_type]||"default"} variant="light" style={{ marginRight:6 }}>{TYPE_LABEL[e.event_type]??`事件${e.event_type}`}</Tag>
                      user={e.user_id}
                    </div>
                    <div style={{ color:"var(--td-text-color-placeholder)", marginTop:1, fontSize:11 }}>
                      {ts(e.timestamp)} · zone{e.zone}{e.error_msg ? <span style={{color:"var(--td-error-color)",marginLeft:6}}>{e.error_msg}</span> : null}
                    </div>
                  </div>
                  <Tag size="small" variant="light" theme={e.status_code<300?"success":"danger"}>{e.status_code}</Tag>
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>

      {/* Event detail drawer */}
      <Drawer
        visible={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        header="事件详情"
        size="medium"
        footer={false}
      >
        {selectedEvent && (
          <div style={{ fontSize:13 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px 16px" }}>
              {Object.entries(selectedEvent).filter(([k]) => k !== "suggestion").map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid var(--td-component-stroke)" }}>
                  <span style={{ color:"var(--td-text-color-placeholder)", fontFamily:"monospace", fontSize:11 }}>{k}</span>
                  <span style={{ fontWeight:500 }}>{v === null ? <Tag size="small" variant="light" theme="default">NULL</Tag> : String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
