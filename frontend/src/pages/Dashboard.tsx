import { useEffect, useState, useMemo } from "react";
import {
  Card, Row, Col, Tag, Drawer, Button, Space, Tooltip, Loading, Divider,
} from "tdesign-react";
import {
  ServerIcon, SecuredIcon, ThunderIcon, BrowseIcon,
  CheckCircleIcon, PlayCircleIcon, AddIcon,
} from "tdesign-icons-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { useEvents } from "@/hooks/useEvents";
import { useT } from "@/i18n/useT";
import { checkHealth, queryEvents } from "@/api/events";

type R = Record<string, any>;

const TYPE_LABEL: Record<number, string> = {
  1: "Authentication", 2: "Authorization", 3: "Data Access",
  4: "Config Change", 5: "Lock Acquire", 6: "Lock Release",
  7: "Financial", 8: "Error",
};

const TYPE_COLOR: Record<number, string> = {
  1: "primary", 2: "success", 3: "default", 4: "warning",
  5: "success", 6: "default", 7: "warning", 8: "danger",
} as const;

const nf = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + "M" :
  n >= 1e3 ? (n / 1e3).toFixed(1) + "K" :
  String(n);

const tfl = (ms: number, locale: string) =>
  new Date(ms).toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

export function Dashboard() {
  const { data, refetch } = useEvents();
  const { t, lang } = useT();

  const [online, setOnline] = useState(false);
  const [detail, setDetail] = useState<R | null>(null);
  const [chart, setChart] = useState<{ t: string; v: number }[]>([]);
  const [dist, setDist] = useState<{ name: string; cnt: number }[]>([]);
  const [seeding, setSeeding] = useState(false);

  const rows: R[] = data?.rows ?? [];
  const total = rows.length;
  const okCount = rows.filter((r: any) => r.status_code < 300).length;

  useEffect(() => {
    checkHealth().then(setOnline);
    const iv = setInterval(() => {
      refetch();
      checkHealth().then(setOnline);
    }, 4000);
    return () => clearInterval(iv);
  }, [refetch]);

  useMemo(() => {
    if (!total) {
      setChart([]);
      setDist([]);
      return;
    }
    const bins: Record<string, number> = {};
    rows.forEach((r: any) => {
      const k = tfl(r.timestamp, lang).slice(0, 5);
      bins[k] = (bins[k] || 0) + 1;
    });
    setChart(
      Object.entries(bins)
        .sort()
        .map(([k, v]) => ({ t: k, v })),
    );
    const d: Record<number, number> = {};
    rows.forEach((r: any) => {
      d[r.event_type] = (d[r.event_type] || 0) + 1;
    });
    setDist(
      Object.entries(d)
        .map(([k, v]) => ({ name: TYPE_LABEL[+k] || k, cnt: v }))
        .sort((a, b) => b.cnt - a.cnt),
    );
  }, [data]);

  const healthPct = total > 0 ? ((okCount / total) * 100) : 100;
  const eps = total > 0 && data?.elapsedMs ? Math.round(total / (data.elapsedMs / 1000)) : 0;

  const kpis = [
    {
      value: nf(total),
      label: t("total_events"),
      icon: <ServerIcon size={20} />,
      color: "#DC2626",
      bg: "var(--td-brand-color-light)",
    },
    {
      value: total > 0 ? `${healthPct.toFixed(0)}%` : "100%",
      label: t("system_health"),
      icon: <SecuredIcon size={20} />,
      color: healthPct >= 95 ? "#34D399" : "#FBBF24",
      bg: healthPct >= 95 ? "var(--td-success-color-1)" : "var(--td-warning-color-1)",
    },
    {
      value: data?.elapsedMs ? `${data.elapsedMs.toFixed(1)}ms` : "—",
      label: t("query_latency"),
      icon: <ThunderIcon size={20} />,
      color: "#DC2626",
      bg: "var(--td-brand-color-light)",
    },
    {
      value: eps > 0 ? `${nf(eps)}/s` : "—",
      label: t("write_throughput"),
      icon: <PlayCircleIcon size={20} />,
      color: "#DC2626",
      bg: "var(--td-brand-color-light)",
    },
  ];

  const seedDemoData = async () => {
    setSeeding(true);
    try {
      // Insert 200 demo events via batch INSERT
      for (let b = 0; b < 200; b += 50) {
        const vals = [];
        for (let i = b; i < Math.min(b + 50, 200); i++) {
          const ts = Date.now() - (200 - i) * 60000; // spread over ~3 hours
          const etype = Math.floor(Math.random() * 8) + 1;
          const status = Math.random() > 0.1 ? 200 : 500;
          vals.push(
            `(${200000 + i},${ts},${Math.floor(Math.random() * 100)},${i * 17},${etype},${Math.floor(Math.random() * 5) + 1},${Math.floor(Math.random() * 3) + 1},${Math.floor(Math.random() * 3) + 1},${status},${0x0A000001 + (i % 255)},${i - 1},'OK','{}')`,
          );
        }
        await queryEvents({
          sql: `INSERT INTO events VALUES ${vals.join(",")}`,
        });
      }
      refetch();
    } catch (e) {
      console.error("Seed failed", e);
    }
    setSeeding(false);
  };

  const emptyState = total === 0;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* ═══ HEADER ═══ */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {t("dashboard")}
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--td-text-color-placeholder)" }}>
            Real-time security event monitoring · {t(online ? "online" : "offline")}
          </p>
        </div>
        <Space size={8}>
          {emptyState && (
            <Button
              theme="primary"
              size="small"
              icon={<AddIcon />}
              loading={seeding}
              onClick={seedDemoData}
            >
              Generate Demo Data
            </Button>
          )}
          <Tag
            size="medium"
            theme={online ? "success" : "default"}
            variant="light"
          >
            {t(online ? "online" : "offline")}
          </Tag>
          <Tag size="medium" variant="light">v1.0</Tag>
        </Space>
      </div>

      {/* ═══ KPI CARDS ═══ */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <Col key={i} xs={24} sm={12} md={6}>
            <Card
              bordered
              style={{
                height: "100%",
                borderRadius: 8,
                transition: "box-shadow 0.15s",
              }}
              hoverShadow
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: k.bg,
                    color: k.color,
                    flexShrink: 0,
                  }}
                >
                  {k.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      color: "var(--td-text-color-primary)",
                    }}
                  >
                    {emptyState && i === 0 ? "—" : k.value}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--td-text-color-placeholder)",
                      marginTop: 2,
                    }}
                  >
                    {k.label}
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ═══ CHARTS ═══ */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          {/* Throughput Chart */}
          <Card
            bordered
            title={
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {t("write_throughput")}
              </span>
            }
            style={{ borderRadius: 8, marginBottom: 16 }}
          >
            {chart.length === 0 ? (
              <EmptyChartPlaceholder
                text={emptyState ? "Insert data to see throughput" : "Collecting data..."}
              />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={chart}
                  margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#DC2626" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#DC2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--td-component-stroke)" vertical={false} />
                  <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="var(--td-text-color-placeholder)" interval={8} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--td-text-color-placeholder)" width={36} axisLine={false} tickLine={false} />
                  <ReTooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} events`, ""]} />
                  <Area type="monotone" dataKey="v" stroke="#DC2626" strokeWidth={2} fill="url(#gradient)" animationDuration={500} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Event Stream */}
          <Card
            bordered
            title={
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {t("event_stream")}
                {total > 0 && (
                  <Tag size="small" theme="primary" variant="light" style={{ marginLeft: 8 }}>
                    {total}
                  </Tag>
                )}
              </span>
            }
            style={{ borderRadius: 8 }}
          >
            {emptyState ? (
              <EmptyChartPlaceholder text="Events will appear here after data insertion" />
            ) : (
              <div style={{ maxHeight: 360, overflow: "auto" }}>
                {rows.slice(0, 15).map((e: any, i: number) => (
                  <div
                    key={e.id ?? i}
                    onClick={() => setDetail(e)}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "10px 12px",
                      cursor: "pointer",
                      borderRadius: 6,
                      transition: "background 0.12s",
                      borderLeft: "3px solid transparent",
                    }}
                    onMouseEnter={(ev) => {
                      (ev.currentTarget as HTMLElement).style.background = "var(--td-bg-color-container-hover)";
                      (ev.currentTarget as HTMLElement).style.borderLeftColor = "var(--td-brand-color)";
                    }}
                    onMouseLeave={(ev) => {
                      (ev.currentTarget as HTMLElement).style.background = "transparent";
                      (ev.currentTarget as HTMLElement).style.borderLeftColor = "transparent";
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        marginTop: 6,
                        flexShrink: 0,
                        background: e.status_code < 300
                          ? "var(--td-success-color)"
                          : "var(--td-error-color)",
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {TYPE_LABEL[e.event_type] ?? `Event ${e.event_type}`}
                        </span>
                        <Tag size="small" variant="light">
                          #{e.id}
                        </Tag>
                        <Tag
                          size="small"
                          variant="light"
                          theme={e.status_code < 300 ? "success" : "danger"}
                        >
                          {e.status_code}
                        </Tag>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)", marginTop: 2 }}>
                        user={e.user_id} · zone={e.zone} · {tfl(e.timestamp, lang)}
                        {e.error_msg && (
                          <span style={{ color: "var(--td-error-color)", marginLeft: 6 }}>
                            ⚠ {e.error_msg}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          {/* Distribution Chart */}
          <Card
            bordered
            title={
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {t("event_distribution")}
              </span>
            }
            style={{ borderRadius: 8, height: "calc(100% - 16px)" }}
          >
            {dist.length === 0 ? (
              <EmptyChartPlaceholder text={emptyState ? "No event data to show" : "Collecting..."} />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={dist}
                  margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--td-component-stroke)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="var(--td-text-color-placeholder)" axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} stroke="var(--td-text-color-placeholder)" tickLine={false} />
                  <ReTooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="cnt" fill="#DC2626" radius={[0, 3, 3, 0]} animationDuration={500} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      {/* ═══ EVENT DETAIL DRAWER ═══ */}
      <Drawer
        visible={detail !== null}
        onClose={() => setDetail(null)}
        header={t("event_detail")}
        size="medium"
        placement="right"
        footer={false}
        closeBtn
      >
        {detail && <EventDetail detail={detail} t={t} lang={lang} />}
      </Drawer>
    </div>
  );
}

/** Empty state placeholder for charts */
function EmptyChartPlaceholder({ text }: { text: string }) {
  return (
    <div
      style={{
        height: 200,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: "var(--td-text-color-placeholder)",
      }}
    >
      <BrowseIcon size={32} style={{ opacity: 0.3 }} />
      <span style={{ fontSize: 13 }}>{text}</span>
    </div>
  );
}

/** Event detail panel */
function EventDetail({ detail, t, lang }: { detail: R; t: any; lang: string }) {
  const ip = (n: number) =>
    `${(n >>> 24) & 0xFF}.${(n >>> 16) & 0xFF}.${(n >>> 8) & 0xFF}.${n & 0xFF}`;
  const loc = (ms: number) =>
    new Date(ms).toLocaleString(lang === "zh" ? "zh-CN" : "en-US");

  const fields: [string, any][] = [
    [t("field_id"), detail.id],
    [
      t("field_event_type"),
      <Tag size="small" variant="light">
        {TYPE_LABEL[detail.event_type] ?? detail.event_type}
      </Tag>,
    ],
    [t("field_timestamp"), loc(detail.timestamp)],
    [t("field_user_id"), detail.user_id],
    [t("field_session_id"), detail.session_id],
    [t("field_ip"), ip(detail.ip_address)],
    [t("field_zone"), detail.zone],
    [t("field_region"), detail.region],
    [
      t("field_status"),
      <Tag
        size="small"
        theme={detail.status_code < 300 ? "success" : "danger"}
        variant="light"
      >
        {detail.status_code}
      </Tag>,
    ],
    [t("field_lock_id"), detail.lock_id],
    [t("field_parent"), detail.parent_event_id || "—"],
  ];
  if (detail.error_msg)
    fields.push([
      t("field_error_msg"),
      <span style={{ color: "var(--td-error-color)" }}>{detail.error_msg}</span>,
    ]);
  if (detail.metadata_json)
    fields.push([
      t("field_metadata"),
      <code style={{ fontSize: 11 }}>{detail.metadata_json}</code>,
    ]);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {fields.map(([k, v], i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "11px 0",
            borderBottom: "1px solid var(--td-component-stroke)",
            fontSize: 13,
          }}
        >
          <span style={{ color: "var(--td-text-color-placeholder)", flexShrink: 0 }}>
            {k}
          </span>
          <span
            style={{
              fontWeight: 600,
              fontFamily: "monospace",
              textAlign: "right",
              marginLeft: 16,
              wordBreak: "break-all",
            }}
          >
            {v}
          </span>
        </div>
      ))}
    </div>
  );
}
