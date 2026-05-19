import { useState, useCallback, useRef, useEffect } from "react";
import { Card, Button, Space, Table, Tag, MessagePlugin, Divider, Tooltip, Select, Textarea, Popconfirm } from "tdesign-react";
import { PlayCircleIcon, ClearIcon, HistoryIcon, BookmarkIcon, FullscreenIcon, FullscreenExitIcon, BrowseIcon, ChevronDownIcon } from "tdesign-icons-react";
import { queryEvents } from "@/api/events";
import type { QueryResponse } from "@/types/api";

const SAMPLE_QUERIES = [
  { label: "所有事件 (最近100条)", sql: "SELECT * FROM events ORDER BY timestamp DESC LIMIT 100;" },
  { label: "按用户统计事件数", sql: "SELECT user_id, COUNT(*) AS cnt FROM events GROUP BY user_id ORDER BY cnt DESC LIMIT 20;" },
  { label: "最近1小时错误事件", sql: "SELECT * FROM events WHERE event_type = 8 AND timestamp > NOW() - INTERVAL '1 hour' ORDER BY timestamp DESC;" },
  { label: "锁冲突分析 (TOP 20)", sql: "SELECT lock_id, COUNT(*) AS conflicts FROM events WHERE event_type IN (5, 6) GROUP BY lock_id HAVING COUNT(*) > 10 ORDER BY conflicts DESC LIMIT 20;" },
  { label: "各分区事件分布", sql: "SELECT zone, COUNT(*) AS events, COUNT(DISTINCT user_id) AS users FROM events GROUP BY zone ORDER BY zone;" },
  { label: "24小时吞吐量时序", sql: "SELECT date_trunc('hour', timestamp) AS hour, COUNT(*) AS eps FROM events WHERE timestamp > NOW() - INTERVAL '24 hours' GROUP BY hour ORDER BY hour;" },
];

export function QueryBuilder() {
  const [sql, setSql] = useState(() => localStorage.getItem("hunt_sql") || SAMPLE_QUERIES[0].sql);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("hunt_sql_history") || "[]"); } catch { return []; }
  });
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") runQuery(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [sql]);

  const addToHistory = useCallback((s: string) => {
    setHistory((prev) => {
      const next = [s, ...prev.filter((h) => h !== s)].slice(0, 20);
      localStorage.setItem("hunt_sql_history", JSON.stringify(next));
      return next;
    });
  }, []);

  const runQuery = useCallback(async () => {
    const trimmed = sql.trim();
    if (!trimmed) return;
    setLoading(true); setError(null); setSuggestion(null); setResult(null);
    try {
      const res = await queryEvents({ sql: trimmed });
      // 检查是否为表名错误建议
      if (res.columns.includes("suggestion") && res.rows.length === 1) {
        const row = res.rows[0] as any;
        setError(row.error);
        setSuggestion(row.suggestion || null);
        MessagePlugin.warning(row.error);
      } else {
        setResult(res); setElapsed(res.elapsedMs);
        localStorage.setItem("hunt_sql", trimmed);
        addToHistory(trimmed);
        MessagePlugin.success(`${res.rows.length} rows · ${res.elapsedMs}ms`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "查询执行失败";
      setError(msg);
      MessagePlugin.error(msg);
    } finally { setLoading(false); }
  }, [sql, addToHistory]);

  const columns = result?.columns?.map((col) => ({
    colKey: col, title: col, width: Math.max(col.length * 14 + 40, 100), ellipsis: true,
    cell: ({ row }: any) => {
      const v = row[col];
      if (v === null || v === undefined) return <Tag size="small" variant="light" theme="default">NULL</Tag>;
      return <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{String(v)}</span>;
    },
  })) || [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>SQL 查询构建器</h2>
        <Select placeholder="▸ 示例查询" style={{ width: 200 }} options={SAMPLE_QUERIES} keys={{ label: "label", value: "sql" }} onChange={(v) => { setSql(v as string); setError(null); }} />
      </div>

      <Card bordered style={{ marginBottom: 16 }}>
        {history.length > 0 && (
          <div style={{ marginBottom: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {history.slice(0, 6).map((h, i) => (
              <Tooltip key={i} content={h.slice(0, 200)}>
                <Tag style={{ cursor: "pointer", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} size="small" variant="light" theme="primary" onClick={() => setSql(h)}>
                  <HistoryIcon style={{ marginRight: 4 }} />{h.replace(/\n/g, " ").slice(0, 40)}
                </Tag>
              </Tooltip>
            ))}
          </div>
        )}

        <Textarea
          value={sql}
          onChange={(v) => { setSql(v as string); setError(null); }}
          placeholder="输入 SQL 查询语句..."
          autosize={{ minRows: fullscreen ? 18 : 6, maxRows: fullscreen ? 28 : 12 }}
          style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Monaco', 'Consolas', monospace",
            fontSize: 13, lineHeight: 1.6, tabSize: 2,
            background: "var(--td-bg-color-component)",
            borderColor: error ? "var(--td-error-color)" : undefined,
          }}
        />

        {error && (
          <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 6, background: "var(--td-warning-color-1)", border: "1px solid var(--td-warning-color-3)", color: "var(--td-warning-color-7)", fontSize: 12 }}>
            {error}
            {suggestion && (
              <span>
                {". "}Did you mean{" "}
                <span
                  onClick={() => { setSql(suggestion); setError(null); setSuggestion(null); runQuery(); }}
                  style={{ cursor: "pointer", color: "var(--td-brand-color)", textDecoration: "underline", fontWeight: 600, fontFamily: "monospace" }}
                >
                  events
                </span>
                {"? "}
                <Tag size="small" theme="primary" style={{ cursor: "pointer", marginLeft: 6 }}
                  onClick={() => { setSql(suggestion); setError(null); setSuggestion(null); }}>
                  Run: {suggestion}
                </Tag>
              </span>
            )}
          </div>
        )}

        <Divider />
        <Space>
          <Button theme="primary" icon={<PlayCircleIcon />} loading={loading} onClick={runQuery}>Ctrl+Enter 执行</Button>
          <Button variant="outline" icon={<ClearIcon />} onClick={() => { setSql(""); setResult(null); setError(null); }}>清除</Button>
          <Button variant="text" icon={fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />} onClick={() => setFullscreen(!fullscreen)} />
          <Popconfirm content="清除所有查询历史?" onConfirm={() => { setHistory([]); localStorage.removeItem("hunt_sql_history"); }}>
            <Button variant="text" icon={<BookmarkIcon />} disabled={history.length === 0}>清除历史</Button>
          </Popconfirm>
          {result && <Tag theme="success" variant="light">{result.rows.length} 行 · {elapsed}ms</Tag>}
        </Space>
      </Card>

      {result && (
        <Card bordered title={`查询结果 · ${result.columns.length} 列`}>
          <Table data={result.rows} columns={columns} rowKey={(_: any, i: number) => String(i)} maxHeight={500} bordered stripe hover size="small" empty="查询结果为空" pagination={{ defaultPageSize: 50, pageSizeOptions: [20, 50, 100, 200], showJumper: true }} />
        </Card>
      )}
    </div>
  );
}
