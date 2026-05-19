import { useState, useCallback, useEffect } from "react";
import { Card, Button, Space, Table, Tag, MessagePlugin, Textarea } from "tdesign-react";
import { PlayCircleIcon, ClearIcon, RefreshIcon } from "tdesign-icons-react";
import { queryEvents } from "@/api/events";
import type { QueryResponse } from "@/types/api";

const DEFAULT = "SELECT * FROM events ORDER BY timestamp DESC LIMIT 100;";

export function QueryBuilder() {
  const [sql, setSql] = useState(() => String(localStorage.getItem("hunt_sql") || DEFAULT));
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [tables, setTables] = useState<{ name: string; cols: number; rows: number }[]>([]);
  const [history, setHistory] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("hunt_sql_history") || "[]"); } catch { return []; } });
  const [elapsed, setElapsed] = useState(0);

  const loadTables = useCallback(async () => {
    try { const r = await queryEvents({ sql: "SHOW TABLES" }); if (r.columns.includes("table_name")) setTables(r.rows.map((x: any) => ({ name: x.table_name, cols: x.columns, rows: x.rows }))); } catch {}
  }, []);

  useEffect(() => { loadTables(); }, [loadTables]);

  const execute = useCallback(async (querySql?: string | null) => {
    const raw = typeof querySql === "string" ? querySql : sql;
    const q = (raw ?? "").trim();
    if (!q) return;
    setLoading(true); setError(null); setSuggestion(null);
    if (typeof querySql === "string") setSql(querySql);
    const t0 = performance.now();
    try {
      const res = await queryEvents({ sql: q });
      setElapsed(performance.now() - t0);
      if (res.columns.includes("suggestion") && res.rows.length === 1) {
        const row = res.rows[0] as any;
        setError(row.error); setSuggestion(row.suggestion ?? null);
      } else {
        setResult(res);
        if (q.toUpperCase().includes("SHOW TABLES")) loadTables();
        localStorage.setItem("hunt_sql", q);
        setHistory((prev) => { const n = [q, ...prev.filter((h) => h !== q)].slice(0, 20); localStorage.setItem("hunt_sql_history", JSON.stringify(n)); return n; });
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? "查询失败");
    } finally { setLoading(false); }
  }, [sql, loadTables]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") execute(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [execute]);

  const cols = result?.columns?.filter((c) => c !== "suggestion").map((c) => ({
    colKey: c, title: c, width: Math.max(c.length * 11 + 32, 90), ellipsis: true,
    cell: ({ row }: any) => row[c] === null || row[c] === undefined ? <Tag size="small" variant="light" theme="default">NULL</Tag> : <span style={{ fontFamily: "monospace", fontSize: 12 }}>{String(row[c])}</span>,
  })) ?? [];

  const isDataResult = result && !result.columns.includes("suggestion") && !result.columns.includes("result") && !result.columns.includes("error");

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 92px)" }}>
      {/* Left panel */}
      <div style={{ width: 210, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, padding: "0 4px" }}>表</div>
        <div style={{ flex: 1, overflow: "auto", background: "var(--td-bg-color-container)", borderRadius: 8, border: "1px solid var(--td-component-stroke)", padding: 4 }}>
          {tables.length === 0 ? <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--td-text-color-placeholder)" }}>暂无表</div> :
            tables.map((t) => (
              <div key={t.name} onClick={() => execute(`SELECT * FROM ${t.name} LIMIT 30`)} style={{ cursor: "pointer", padding: "6px 8px", borderRadius: 4, display: "flex", justifyContent: "space-between", fontSize: 12 }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--td-bg-color-component)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                <span style={{ fontFamily: "monospace", fontWeight: 500 }}>{t.name}</span><span style={{ color: "var(--td-text-color-placeholder)", fontSize: 10 }}>{t.rows ?? 0}</span>
              </div>
            ))}
        </div>
        <Button block variant="outline" size="small" icon={<RefreshIcon />} onClick={loadTables}>刷新</Button>
        <div style={{ fontSize: 12, fontWeight: 600, padding: "0 4px", marginTop: 8 }}>历史</div>
        <div style={{ flex: 1, overflow: "auto", background: "var(--td-bg-color-container)", borderRadius: 8, border: "1px solid var(--td-component-stroke)", padding: 4, maxHeight: 200 }}>
          {history.length === 0 ? <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--td-text-color-placeholder)" }}>暂无</div> :
            history.map((h, i) => (
              <div key={i} onClick={() => setSql(h)} style={{ cursor: "pointer", padding: "4px 6px", borderRadius: 3, fontSize: 10, fontFamily: "monospace", color: "var(--td-text-color-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={h}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--td-bg-color-component)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}>{h.replace(/\n/g, " ").slice(0, 55)}</div>
            ))}
        </div>
      </div>

      {/* Right: editor + results */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <Card bordered style={{ flexShrink: 0 }}>
          <Textarea value={String(sql ?? "")} onChange={(v) => { setSql(String(v ?? "")); setError(null); }} placeholder="SQL ... Ctrl+Enter" autosize={{ minRows: 5, maxRows: 12 }} style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }} />
          {error && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "var(--td-warning-color-1)", border: "1px solid var(--td-warning-color-3)", fontSize: 12 }}>{error}{suggestion ? <span> · <span onClick={() => execute(suggestion)} style={{ cursor: "pointer", color: "var(--td-brand-color)", fontWeight: 600, fontFamily: "monospace" }}>{suggestion}</span></span> : null}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <Space>
              <Button theme="primary" icon={<PlayCircleIcon />} loading={loading} onClick={() => execute()}>执行</Button>
              <Button variant="outline" icon={<ClearIcon />} onClick={() => { setSql(""); setResult(null); setError(null); }}>清除</Button>
              <Button variant="text" size="small" onClick={() => execute("SHOW TABLES")}>SHOW TABLES</Button>
            </Space>
            {isDataResult && <Tag theme="success" variant="light">{result.rows.length} 行 · {elapsed.toFixed(1)}ms</Tag>}
          </div>
        </Card>

        {result && result.columns.includes("result") && !result.columns.includes("suggestion") && (
          <Card bordered>{result.rows.map((r: any, i: number) => <div key={i} style={{ fontSize: 13, color: r.error ? "var(--td-error-color)" : "var(--td-success-color)" }}>{r.result ?? r.error}</div>)}</Card>
        )}

        {isDataResult && (
          <Card bordered title={`结果 · ${result.columns.length} 列`} style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            <Table data={result.rows} columns={cols} rowKey={(_: any, i: number) => String(i)} maxHeight={400} bordered stripe hover size="small" empty="0 行" pagination={{ defaultPageSize: 50, pageSizeOptions: [20, 50, 100], showJumper: true }} />
          </Card>
        )}
      </div>
    </div>
  );
}
