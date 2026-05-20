import { useState, useCallback, useEffect, useRef } from "react";
import {
  Card, Button, Space, Table, Tag, MessagePlugin,
  Popconfirm, Tooltip, Loading,
} from "tdesign-react";
import {
  PlayCircleIcon, ClearIcon, DownloadIcon, UploadIcon,
  BrowseIcon, TimeIcon, DeleteIcon, FileIcon,
  AddIcon, CloseIcon,
} from "tdesign-icons-react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { queryEvents } from "@/api/events";
import { useT } from "@/i18n/useT";
import type { QueryResponse } from "@/types/api";

const DEFAULT_SQL = "SELECT * FROM events ORDER BY timestamp DESC LIMIT 100;";
const SAMPLES: { label: string; sql: string }[] = [
  { label: "Top events", sql: "SELECT event_type, COUNT(*) as cnt FROM events GROUP BY event_type ORDER BY cnt DESC;" },
  { label: "Error scan", sql: "SELECT * FROM events WHERE event_type = 8 AND status_code >= 400 ORDER BY timestamp DESC;" },
  { label: "Zone stats", sql: "SELECT zone, COUNT(*) as events FROM events GROUP BY zone ORDER BY zone;" },
  { label: "User activity", sql: "SELECT user_id, COUNT(*) as cnt FROM events GROUP BY user_id ORDER BY cnt DESC LIMIT 10;" },
  { label: "Show tables", sql: "SHOW TABLES;" },
  { label: "Show users", sql: "SHOW USERS;" },
  { label: "Describe", sql: "DESCRIBE events;" },
];

interface TabState {
  id: number;
  name: string;
  sql: string;
  result: QueryResponse | null;
  loading: boolean;
  error: string | null;
  suggestion: string | null;
  elapsed: number;
}

let nextTabId = 1;

function createTab(sql?: string): TabState {
  return {
    id: nextTabId++,
    name: `Query ${nextTabId - 1}`,
    sql: sql ?? DEFAULT_SQL,
    result: null,
    loading: false,
    error: null,
    suggestion: null,
    elapsed: 0,
  };
}

export function QueryBuilder() {
  const { t } = useT();

  const [tabs, setTabs] = useState<TabState[]>(() => {
    const saved = localStorage.getItem("hunt_sql");
    return [createTab(saved || DEFAULT_SQL)];
  });
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]?.id ?? 0);
  const [tables, setTables] = useState<{ name: string; cols: number; rows: number }[]>([]);
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("hunt_sql_history") || "[]"); }
    catch { return []; }
  });
  const [sidebarTab, setSidebarTab] = useState<"tables" | "history" | "samples">("tables");
  const editorRefs = useRef<Map<number, Parameters<OnMount>[0]>>(new Map());

  const activeTab = tabs.find((tb) => tb.id === activeTabId) ?? tabs[0];

  const updateTab = useCallback((id: number, patch: Partial<TabState>) => {
    setTabs((prev) => prev.map((tb) => (tb.id === id ? { ...tb, ...patch } : tb)));
  }, []);

  const loadTables = useCallback(async () => {
    try {
      const r = await queryEvents({ sql: "SHOW TABLES" });
      if (r.columns.includes("table_name")) {
        setTables(r.rows.map((x: any) => ({ name: x.table_name, cols: x.columns, rows: x.rows })));
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadTables(); }, [loadTables]);

  const execute = useCallback(async (tabId: number, querySql?: string | null) => {
    const tab = tabs.find((tb) => tb.id === tabId);
    if (!tab) return;
    const raw = typeof querySql === "string" ? querySql : tab.sql;
    const q = (raw ?? "").trim();
    if (!q) return;

    updateTab(tabId, { loading: true, error: null, suggestion: null });
    if (typeof querySql === "string") updateTab(tabId, { sql: querySql });

    const t0 = performance.now();
    try {
      const res = await queryEvents({ sql: q });
      const elapsed = performance.now() - t0;

      if (res.columns.includes("suggestion") && res.rows.length === 1) {
        updateTab(tabId, {
          error: String(res.rows[0].error ?? ""),
          suggestion: String(res.rows[0].suggestion ?? "") || null,
          loading: false, elapsed,
        });
      } else {
        updateTab(tabId, { result: res, loading: false, elapsed });
        if (q.toUpperCase().includes("SHOW TABLES")) loadTables();
        localStorage.setItem("hunt_sql", q);
        setHistory((prev) => {
          const next = [q, ...prev.filter((h) => h !== q)].slice(0, 20);
          localStorage.setItem("hunt_sql_history", JSON.stringify(next));
          return next;
        });
      }
    } catch (err: any) {
      updateTab(tabId, {
        error: err?.response?.data?.error ?? err?.message ?? t("query_failed"),
        loading: false,
      });
    }
  }, [tabs, updateTab, loadTables, t]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && activeTab) {
        execute(activeTab.id);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [execute, activeTab]);

  const handleEditorMount: OnMount = useCallback((editor, _monaco) => {
    if (activeTab) editorRefs.current.set(activeTab.id, editor);
    editor.addAction({
      id: "run-query",
      label: "Run Query",
      keybindings: [2048 | 3],
      run: () => activeTab && execute(activeTab.id),
    });
    editor.focus();
  }, [execute, activeTab]);

  const addTab = () => {
    const newTab = createTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (id: number) => {
    editorRefs.current.delete(id);
    setTabs((prev) => {
      const next = prev.filter((tb) => tb.id !== id);
      if (next.length === 0) {
        const fresh = createTab();
        setActiveTabId(fresh.id);
        return [fresh];
      }
      if (id === activeTabId) setActiveTabId(next[0].id);
      return next;
    });
  };

  // ── export / import (same logic, operates on active tab) ──

  const isData = activeTab?.result && !activeTab.result.columns.includes("suggestion") && !activeTab.result.columns.includes("result") && !activeTab.result.columns.includes("error");

  const cols = activeTab?.result?.columns
    ?.filter((c) => c !== "suggestion")
    .map((c) => ({
      colKey: c,
      title: c,
      width: Math.max(c.length * 12 + 48, 100),
      ellipsis: true,
      cell: ({ row }: any) =>
        row[c] === null || row[c] === undefined ? (
          <Tag size="small" variant="light" theme="default">NULL</Tag>
        ) : (
          <span style={{ fontFamily: "monospace", fontSize: 12 }}>{String(row[c])}</span>
        ),
    })) ?? [];

  const exportData = (fmt: string) => {
    if (!activeTab?.result || !isData) return;
    const cs = activeTab.result.columns.filter((c) => c !== "suggestion");
    const rows = activeTab.result.rows as any[];
    let content = "", ext = "", mime = "text/plain";
    if (fmt === "csv") {
      ext = "csv"; mime = "text/csv";
      content = cs.join(",") + "\n" + rows.map((r: any) =>
        cs.map((c) => {
          const v = r[c]; if (v === null || v === undefined) return "";
          const s = String(v);
          return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(",")
      ).join("\n");
    } else if (fmt === "json") {
      ext = "json"; mime = "application/json";
      content = JSON.stringify(rows.map((r: any) => { const o: any = {}; cs.forEach((c) => o[c] = r[c]); return o; }), null, 2);
    } else if (fmt === "txt") {
      ext = "txt";
      content = rows.map((r: any) => cs.map((c) => `${c}: ${r[c] ?? "NULL"}`).join(" | ")).join("\n");
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `query_result.${ext}`; a.click();
    URL.revokeObjectURL(url);
    MessagePlugin.success(t("export_done"));
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    const fname = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_");
    const ts = Date.now();
    let rows: any[] = [], cols: string[] = [];
    if (file.name.endsWith(".csv")) {
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) { MessagePlugin.error(t("csv_header")); return; }
      cols = lines[0].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      rows = lines.slice(1).map((l) => {
        const vals: any[] = []; let cur = "", inQ = false;
        for (const ch of l) {
          if (ch === '"') inQ = !inQ;
          else if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; }
          else cur += ch;
        }
        vals.push(cur.trim()); return vals;
      });
    } else if (file.name.endsWith(".json")) {
      const data = JSON.parse(text); const arr = Array.isArray(data) ? data : [data];
      if (arr.length === 0) { MessagePlugin.error(t("json_empty")); return; }
      cols = Object.keys(arr[0]); rows = arr.map((r: any) => cols.map((c) => r[c]));
    } else if (file.name.endsWith(".txt")) {
      const lines = text.split("\n").filter((l) => l.trim().includes("|"));
      cols = lines[0].split("|").map((c) => c.split(":")[0].trim());
      rows = lines.map((l) => l.split("|").map((p) => p.includes(":") ? p.split(":").slice(1).join(":").trim() : p.trim()));
    } else { MessagePlugin.error(t("unsupported_fmt")); return; }

    const tname = fname + "_" + ts;
    const colDefs = cols.map((c) => `${c} VARCHAR`).join(", ");
    try {
      await queryEvents({ sql: `CREATE TABLE ${tname} (${colDefs})` });
      MessagePlugin.success(t("table_created"));
      for (const row of rows) {
        const vals = row.map((v: any) =>
          v === null || v === undefined || String(v).toLowerCase() === "null"
            ? "NULL"
            : `'${String(v).replace(/'/g, "''")}'`
        ).join(", ");
        await queryEvents({ sql: `INSERT INTO ${tname} VALUES (${vals})` });
      }
      MessagePlugin.success(t("import_done"));
      loadTables();
    } catch (err: any) { MessagePlugin.error(t("import_fail")); }
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const clearHistory = () => {
    setHistory([]); localStorage.removeItem("hunt_sql_history");
    MessagePlugin.success(t("clear_history"));
  };

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 96px)" }}>
      <input type="file" accept=".csv,.json,.txt" style={{ display: "none" }} ref={fileRef}
        onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) { importFile(f); e.target.value = ""; } }}
      />

      {/* ═══ LEFT SIDEBAR ═══ */}
      <aside style={{ width: 272, minWidth: 272, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", background: "var(--td-bg-color-component)", borderRadius: 6, padding: 3 }}>
          {(["tables", "history", "samples"] as const).map((key) => {
            const labels: Record<string, string> = { tables: t("tables"), history: t("query_history"), samples: t("samples") };
            const icons: Record<string, any> = { tables: BrowseIcon, history: TimeIcon, samples: FileIcon };
            const Icon = icons[key];
            return (
              <button key={key} onClick={() => setSidebarTab(key)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "7px 0", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13,
                  fontWeight: sidebarTab === key ? 600 : 400,
                  color: sidebarTab === key ? "var(--td-brand-color)" : "var(--td-text-color-secondary)",
                  background: sidebarTab === key ? "var(--td-bg-color-container)" : "transparent",
                  transition: "all 0.15s",
                }}
              >
                <Icon size={15} />{labels[key]}
              </button>
            );
          })}
        </div>

        <Card bordered style={{ flex: 1, overflow: "auto", padding: 0 }} bodyStyle={{ padding: 0 }}>
          {sidebarTab === "tables" && (
            <div style={{ padding: "4px 0" }}>
              {tables.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--td-text-color-placeholder)", fontSize: 13 }}>
                  <BrowseIcon size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <div>{t("no_tables")}</div>
                </div>
              ) : (
                tables.map((tb) => (
                  <div key={tb.name}
                    onClick={() => activeTab && execute(activeTab.id, `SELECT * FROM ${tb.name} LIMIT 30`)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", cursor: "pointer", transition: "background 0.12s", borderLeft: "3px solid transparent" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--td-bg-color-container-hover)"; (e.currentTarget as HTMLElement).style.borderLeftColor = "var(--td-brand-color)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderLeftColor = "transparent"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <BrowseIcon size={15} style={{ color: "var(--td-brand-color)", opacity: 0.7 }} />
                      <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 500 }}>{tb.name}</span>
                    </div>
                    <Tag size="small" variant="light" theme="primary">{tb.rows ?? 0} {t("rows_n")}</Tag>
                  </div>
                ))
              )}
            </div>
          )}

          {sidebarTab === "history" && (
            <div style={{ padding: "4px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 16px 8px" }}>
                <span style={{ fontSize: 12, color: "var(--td-text-color-placeholder)" }}>
                  {history.length > 0 ? `${history.length} records` : t("history_empty")}
                </span>
                {history.length > 0 && (
                  <Popconfirm content={t("clear_history_confirm")} onConfirm={clearHistory}>
                    <Button size="small" variant="text" theme="default" icon={<DeleteIcon />} style={{ padding: "0 4px", height: 24 }} />
                  </Popconfirm>
                )}
              </div>
              {history.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--td-text-color-placeholder)", fontSize: 13 }}>
                  <TimeIcon size={28} style={{ marginBottom: 8, opacity: 0.4 }} /><div>{t("history_empty")}</div>
                </div>
              ) : (
                history.slice(0, 20).map((h, i) => (
                  <div key={i}
                    onClick={() => activeTab && updateTab(activeTab.id, { sql: h })}
                    style={{ padding: "8px 16px", cursor: "pointer", fontFamily: "monospace", fontSize: 12, color: "var(--td-text-color-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "background 0.12s", borderLeft: "3px solid transparent" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--td-bg-color-container-hover)"; (e.currentTarget as HTMLElement).style.borderLeftColor = "var(--td-brand-color)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderLeftColor = "transparent"; }}
                    title={h}
                  >
                    {h.replace(/\n/g, " ").slice(0, 55)}{h.length > 55 ? "…" : ""}
                  </div>
                ))
              )}
            </div>
          )}

          {sidebarTab === "samples" && (
            <div style={{ padding: "8px" }}>
              {SAMPLES.map((s, i) => (
                <div key={i}
                  onClick={() => activeTab && execute(activeTab.id, s.sql)}
                  style={{ padding: "10px 12px", marginBottom: 6, borderRadius: 6, cursor: "pointer", border: "1px solid var(--td-component-border)", transition: "all 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--td-brand-color)"; (e.currentTarget as HTMLElement).style.background = "var(--td-brand-color-light)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--td-component-border)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: "var(--td-text-color-primary)" }}>{s.label}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--td-text-color-placeholder)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.sql}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </aside>

      {/* ═══ MAIN AREA ═══ */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        {/* Tab bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, borderBottom: "2px solid var(--td-component-border)" }}>
          <div style={{ display: "flex", flex: 1, overflow: "auto" }}>
            {tabs.map((tab) => (
              <div key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: tab.id === activeTabId ? 600 : 400,
                  color: tab.id === activeTabId ? "var(--td-brand-color)" : "var(--td-text-color-secondary)",
                  background: tab.id === activeTabId ? "var(--td-bg-color-container)" : "transparent",
                  borderBottom: tab.id === activeTabId ? "2px solid var(--td-brand-color)" : "2px solid transparent",
                  marginBottom: -2, whiteSpace: "nowrap", transition: "all 0.15s",
                }}
              >
                {tab.loading && <Loading size="small" />}
                <span>{tab.name}</span>
                {tabs.length > 1 && (
                  <CloseIcon size={14} style={{ opacity: 0.4, cursor: "pointer" }}
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  />
                )}
              </div>
            ))}
          </div>
          <Button size="small" variant="text" icon={<AddIcon />} onClick={addTab} style={{ marginRight: 4 }}>
            {t("ctrl_enter").replace("Ctrl+Enter", "New")}
          </Button>
        </div>

        {activeTab && (
          <>
            {/* Editor Card */}
            <Card bordered style={{ borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }} bodyStyle={{ padding: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "var(--td-bg-color-page)", borderBottom: "1px solid var(--td-component-border)" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--td-text-color-primary)" }}>{t("editor")}</span>
                <span style={{ fontSize: 11, color: "var(--td-text-color-placeholder)", fontFamily: "monospace" }}>Ctrl+Enter</span>
              </div>

              <div style={{ borderBottom: activeTab.error ? "2px solid var(--td-error-color)" : "1px solid var(--td-component-border)" }}>
                <Editor
                  // re-mount editor when tab changes
                  key={activeTab.id}
                  height="200px"
                  language="sql"
                  theme="vs-dark"
                  value={activeTab.sql}
                  onChange={(v) => updateTab(activeTab.id, { sql: v ?? "", error: null })}
                  onMount={handleEditorMount}
                  options={{
                    minimap: { enabled: false }, fontSize: 14, lineNumbers: "on",
                    lineNumbersMinChars: 3, folding: true, glyphMargin: false,
                    scrollBeyondLastLine: false, wordWrap: "on",
                    padding: { top: 12, bottom: 12 }, renderLineHighlight: "line",
                    smoothScrolling: true, cursorBlinking: "smooth",
                    cursorSmoothCaretAnimation: "on", automaticLayout: true,
                    tabSize: 2, suggest: { showKeywords: true, showSnippets: true },
                  }}
                />
              </div>

              {activeTab.error && (
                <div style={{ padding: "10px 16px", background: "var(--td-error-color-1)", borderBottom: "1px solid var(--td-error-color-3)", fontSize: 13, color: "var(--td-error-color-7)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1 }}>{activeTab.error}</span>
                  {activeTab.suggestion && (
                    <Button size="small" variant="outline" theme="primary" onClick={() => execute(activeTab.id, activeTab.suggestion)}>
                      {activeTab.suggestion}
                    </Button>
                  )}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "var(--td-bg-color-page)" }}>
                <Space size={8}>
                  <Button theme="primary" icon={<PlayCircleIcon />} loading={activeTab.loading} onClick={() => execute(activeTab.id)} style={{ fontWeight: 500 }}>
                    {t("execute")}
                  </Button>
                  <Button variant="outline" icon={<ClearIcon />} onClick={() => updateTab(activeTab.id, { sql: "", result: null, error: null, suggestion: null })}>
                    {t("clear")}
                  </Button>
                </Space>
                <Space size={8}>
                  {isData && (
                    <Tag theme="success" variant="light" size="medium">
                      {activeTab.result!.rows.length} rows · {activeTab.elapsed.toFixed(1)}ms
                    </Tag>
                  )}
                  {activeTab.loading && <Loading size="small" style={{ display: "inline-flex" }} />}
                  <Tooltip content={t("import")}>
                    <Button size="small" variant="text" icon={<UploadIcon />} onClick={() => fileRef.current?.click()} />
                  </Tooltip>
                  {isData && (
                    <Space size={2}>
                      {["csv", "json", "txt"].map((fmt) => (
                        <Button key={fmt} size="small" variant="text" onClick={() => exportData(fmt)}>.{fmt}</Button>
                      ))}
                    </Space>
                  )}
                </Space>
              </div>
            </Card>

            {/* System result (SHOW / DESCRIBE / DDL) */}
            {activeTab.result && activeTab.result.columns.includes("result") && !activeTab.result.columns.includes("suggestion") && (
              <Card bordered>
                {activeTab.result.rows.map((r: any, i: number) => (
                  <div key={i} style={{ fontSize: 13, fontFamily: "monospace", padding: "4px 0", color: r.error ? "var(--td-error-color)" : "var(--td-success-color)" }}>
                    {r.result ?? r.error}
                  </div>
                ))}
              </Card>
            )}

            {/* Data result table */}
            {isData && (
              <Card bordered
                title={<span style={{ fontSize: 14, fontWeight: 600 }}>{t("result_cols").replace("{n}", String(activeTab.result!.columns.length))}</span>}
                actions={
                  <Space size={4}>
                    {["csv", "json", "txt"].map((fmt) => (
                      <Button key={fmt} size="small" variant="outline" icon={<DownloadIcon />} onClick={() => exportData(fmt)}>.{fmt}</Button>
                    ))}
                  </Space>
                }
                style={{ flex: 1, overflow: "auto" }}
              >
                <Table
                  data={activeTab.result!.rows.map((r: any, i: number) => ({ ...r, _rk: i }))}
                  columns={cols}
                  rowKey="_rk"
                  maxHeight={400} bordered stripe hover size="small" empty={t("no_data")}
                  pagination={{ defaultPageSize: 50, pageSizeOptions: [20, 50, 100, 200], showJumper: true }}
                />
              </Card>
            )}

            {/* Empty state */}
            {!activeTab.result && !activeTab.loading && !activeTab.error && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--td-text-color-placeholder)", gap: 8, padding: 48 }}>
                <PlayCircleIcon size={40} style={{ opacity: 0.25 }} />
                <div style={{ fontSize: 14 }}>{t("run_query")}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Ctrl+Enter · {t("ctrl_enter")}</div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
