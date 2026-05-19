import { useState, useCallback, useEffect } from "react";
import { Card, Button, Space, Table, Tag, MessagePlugin, Divider, Textarea, Row, Col, Loading } from "tdesign-react";
import { PlayCircleIcon, ClearIcon, HistoryIcon, BrowseIcon, RefreshIcon, ChevronRightIcon } from "tdesign-icons-react";
import { queryEvents } from "@/api/events";
import type { QueryResponse } from "@/types/api";

const SAMPLE = "SELECT * FROM events ORDER BY timestamp DESC LIMIT 100;";

export function QueryBuilder() {
  const [sql, setSql] = useState(() => String(localStorage.getItem("hunt_sql") || SAMPLE));
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [history, setHistory] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("hunt_sql_history") || "[]"); } catch { return []; } });
  const [tables, setTables] = useState<{ name: string; columns: number; rows: number }[]>([]);
  const [sidebarTab, setSidebarTab] = useState<"tables" | "history">("tables");

  // 加载表列表
  const loadTables = useCallback(async () => {
    try {
      const res = await queryEvents({ sql: "SHOW TABLES" });
      if (res.columns.includes("table_name")) {
        setTables(res.rows.map((r: any) => ({ name: r.table_name, columns: r.columns, rows: r.rows })));
      }
    } catch {}
  }, []);

  useEffect(() => { loadTables(); }, [loadTables]);

  const executeQuery = useCallback(async (querySql?: string | null) => {
    const raw = typeof querySql === "string" ? querySql : sql;
    const trimmed = (raw ?? "").trim();
    if (!trimmed) return;
    setLoading(true); setError(null); setSuggestion(null);
    if (typeof querySql === "string") setSql(querySql);
    try {
      const res = await queryEvents({ sql: trimmed });
      if (res.columns.includes("suggestion") && res.rows.length === 1) {
        const row = res.rows[0] as any;
        setError(row.error); setSuggestion(row.suggestion || null);
      } else {
        setResult(res); setElapsed(res.elapsedMs);
        if (trimmed.toUpperCase().includes("SHOW TABLES")) loadTables();
        localStorage.setItem("hunt_sql", trimmed);
        setHistory((prev) => { const next = [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, 20); localStorage.setItem("hunt_sql_history", JSON.stringify(next)); return next; });
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "查询失败");
    } finally { setLoading(false); }
  }, [sql, loadTables]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") executeQuery(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [executeQuery]);

  const tabClick = (name: string) => executeQuery(`SELECT * FROM ${name} LIMIT 30`);

  const resultColumns = result?.columns?.filter((c) => c !== "suggestion").map((col) => ({
    colKey: col, title: col, width: Math.max(col.length * 12 + 40, 100), ellipsis: true,
    cell: ({ row }: any) => {
      const v = row[col];
      if (v === null || v === undefined) return <Tag size="small" variant="light" theme="default">NULL</Tag>;
      return <span style={{ fontFamily: "monospace", fontSize: 12 }}>{String(v)}</span>;
    },
  })) || [];

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 92px)" }}>
      {/* 左侧面板 */}
      <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 0, background: "var(--td-bg-color-component)", borderRadius: 8, padding: 2 }}>
          {(["tables", "history"] as const).map((tab) => (
            <Button key={tab} size="small" variant={sidebarTab === tab ? "base" : "text"} style={{ flex: 1, fontSize: 12 }} onClick={() => setSidebarTab(tab)}>
              {tab === "tables" ? "表" : "历史"}
            </Button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: "auto", background: "var(--td-bg-color-container)", borderRadius: 8, border: "1px solid var(--td-component-stroke)", padding: 4 }}>
          {sidebarTab === "tables" ? (
            tables.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--td-text-color-placeholder)" }}>
                运行 SHOW TABLES 加载
                <Button size="small" variant="text" icon={<RefreshIcon />} onClick={loadTables} style={{ marginTop: 8 }}>刷新</Button>
              </div>
            ) : (
              tables.map((t) => (
                <div key={t.name}
                  onClick={() => tabClick(t.name)}
                  style={{ cursor: "pointer", padding: "8px 10px", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--td-bg-color-component)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span style={{ fontFamily: "monospace", fontWeight: 500 }}>{t.name}</span>
                  <span style={{ fontSize: 10, color: "var(--td-text-color-placeholder)" }}>{t.rows ?? "0"}</span>
                </div>
              ))
            )
          ) : (
            history.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--td-text-color-placeholder)" }}>暂无查询历史</div>
            ) : (
              history.slice(0, 30).map((h, i) => (
                <div key={i}
                  onClick={() => setSql(h)}
                  style={{ cursor: "pointer", padding: "6px 8px", borderRadius: 4, fontSize: 11, fontFamily: "monospace", color: "var(--td-text-color-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--td-bg-color-component)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  title={h}
                >{h.replace(/\n/g, " ").slice(0, 50)}</div>
              ))
            )
          )}
        </div>

        <Button block variant="outline" icon={<RefreshIcon />} size="small" onClick={loadTables}>刷新表列表</Button>
      </div>

      {/* 主编辑区 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <Card bordered style={{ flexShrink: 0 }}>
          <Textarea
            value={String(sql ?? "")}
            onChange={(v) => { setSql(String(v ?? "")); setError(null); }}
            placeholder="输入 SQL 语句...  (Ctrl+Enter 执行)"
            autosize={{ minRows: 5, maxRows: 12 }}
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 13, lineHeight: 1.6 }}
          />

          {error && (
            <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "var(--td-warning-color-1)", border: "1px solid var(--td-warning-color-3)", fontSize: 12 }}>
              {error}
              {suggestion && (
                <span>. <span onClick={() => executeQuery(suggestion)} style={{ cursor: "pointer", color: "var(--td-brand-color)", fontWeight: 600, fontFamily: "monospace" }}>Execute: {suggestion}</span></span>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <Space>
              <Button theme="primary" icon={<PlayCircleIcon />} loading={loading} onClick={() => executeQuery()}>执行 Ctrl+Enter</Button>
              <Button variant="outline" icon={<ClearIcon />} onClick={() => { setSql(""); setResult(null); setError(null); }}>清除</Button>
              <Button variant="text" size="small" onClick={() => executeQuery("SHOW TABLES")}>SHOW TABLES</Button>
            </Space>
            {result && !result.columns.includes("suggestion") && (
              <Tag theme="success" variant="light">{result.rows.length} rows · {(elapsed ?? 0).toFixed(1)}ms</Tag>
            )}
          </div>
        </Card>

        {/* 结果表 */}
        {result && !result.columns.includes("error") && !result.columns.includes("result") && (
          <Card bordered title={`结果 · ${result.columns.length} 列`} style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            <Table data={result.rows} columns={resultColumns} rowKey={(_: any, i: number) => String(i)} maxHeight={400} bordered stripe hover size="small" empty="0 行" pagination={{ defaultPageSize: 50, pageSizeOptions: [20, 50, 100, 200], showJumper: true }} />
          </Card>
        )}

        {/* DDL结果消息 */}
        {result && (result.columns.includes("result") || result.columns.includes("error")) && !result.columns.includes("suggestion") && (
          <Card bordered>
            {result.rows.map((row: any, i: number) => (
              <div key={i} style={{ fontSize: 13, color: row.error ? "var(--td-error-color)" : "var(--td-success-color)" }}>
                {row.result || row.error}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
