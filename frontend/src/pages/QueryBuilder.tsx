import { useState } from "react";
import { Card, Button, Textarea, Table, Tag, Space, MessagePlugin } from "tdesign-react";
import { PlayCircleIcon, ClearIcon } from "tdesign-icons-react";
import { queryEvents } from "@/api/events";
import type { QueryResponse } from "@/types/api";

export function QueryBuilder() {
  const [sql, setSql] = useState("SELECT * FROM events ORDER BY timestamp DESC LIMIT 20");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const runQuery = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    try {
      const res = await queryEvents({ sql });
      setResult(res);
      MessagePlugin.success(`查询完成: ${res.rows.length} 行, ${res.elapsedMs}ms`);
    } catch {
      MessagePlugin.error("查询执行失败");
    } finally {
      setLoading(false);
    }
  };

  const columns = result?.columns.map((col) => ({
    colKey: col, title: col, width: 150,
  })) || [];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">SQL 查询构建器</h2>

      <Card bordered className="mb-4">
        <div className="space-y-3">
          <Textarea
            value={sql}
            onChange={(v) => setSql(v as string)}
            placeholder="输入 SQL 查询语句..."
            autosize={{ minRows: 4, maxRows: 12 }}
            style={{ fontFamily: "monospace", fontSize: 14 }}
          />
          <Space>
            <Button theme="primary" icon={<PlayCircleIcon />} loading={loading} onClick={runQuery}>
              执行查询
            </Button>
            <Button variant="outline" icon={<ClearIcon />} onClick={() => { setSql(""); setResult(null); }}>
              清除
            </Button>
            {result && (
              <Tag theme="success" variant="light">
                {result.rows.length} 行 · {result.elapsedMs}ms
              </Tag>
            )}
          </Space>
        </div>
      </Card>

      {result && (
        <Card bordered>
          <Table
            data={result.rows}
            columns={columns}
            rowKey={(row: any, i: number) => row.id || i}
            maxHeight={400}
            empty="查询结果为空"
          />
        </Card>
      )}
    </div>
  );
}
