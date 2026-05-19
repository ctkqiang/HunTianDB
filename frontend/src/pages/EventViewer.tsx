import { useState } from "react";
import { Card, Table, Tag, Input, Select, Space, Button, DateRangePicker } from "tdesign-react";
import { SearchIcon, RefreshIcon, FilterIcon, DownloadIcon } from "tdesign-icons-react";
import { useEvents } from "@/hooks/useEvents";
import { useFilterStore } from "@/store/filterStore";

const TYPE_LABELS: Record<number, string> = { 1: "认证", 2: "授权", 3: "数据访问", 4: "配置变更", 5: "锁获取", 6: "锁释放", 7: "金融交易", 8: "错误" };
const TYPE_THEMES: Record<number, "primary" | "success" | "warning" | "danger" | "default"> = { 1: "primary", 2: "success", 3: "default", 4: "warning", 5: "success", 6: "default", 7: "warning", 8: "danger" };

export function EventViewer() {
  const { data, isLoading, refetch } = useEvents();
  const filters = useFilterStore();
  const [search, setSearch] = useState("");

  const columns = [
    { colKey: "id", title: "ID", width: 80, sorter: true },
    { colKey: "timestamp", title: "时间戳", width: 180, ellipsis: true },
    { colKey: "user_id", title: "用户", width: 80 },
    {
      colKey: "event_type", title: "类型", width: 100,
      cell: ({ row }: any) => <Tag size="small" theme={TYPE_THEMES[row.event_type] || "default"} variant="light">{TYPE_LABELS[row.event_type] || row.event_type}</Tag>,
    },
    { colKey: "lock_id", title: "锁ID", width: 70 },
    { colKey: "zone", title: "分区", width: 60 },
    { colKey: "region", title: "区域", width: 60 },
    { colKey: "status_code", title: "状态码", width: 80,
      cell: ({ row }: any) => {
        const ok = row.status_code >= 200 && row.status_code < 300;
        return <Tag size="small" theme={ok ? "success" : "danger"} variant="light">{row.status_code}</Tag>;
      },
    },
    { colKey: "session_id", title: "会话ID", width: 120, ellipsis: true },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>安全事件查看器</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--td-text-color-placeholder)" }}>浏览、搜索和分析所有安全审计事件</p>
        </div>
        <Space>
          <Button icon={<RefreshIcon />} variant="outline" onClick={() => refetch()}>刷新</Button>
          <Button icon={<DownloadIcon />} variant="outline">导出</Button>
        </Space>
      </div>

      <Card bordered style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Input value={search} onChange={(v) => setSearch(v as string)} placeholder="搜索事件ID或用户..." prefixIcon={<SearchIcon />} style={{ flex: 1, minWidth: 200 }} />
          <Input placeholder="用户ID" style={{ width: 120 }} onChange={(v) => filters.setUserId(Number(v) || null)} />
          <Select placeholder="事件类型" style={{ width: 130 }} clearable options={Object.entries(TYPE_LABELS).map(([k, v]) => ({ label: v, value: Number(k) }))} onChange={(v) => filters.setEventType(v as number || null)} />
          <Input placeholder="分区" style={{ width: 80 }} onChange={(v) => filters.setZone(Number(v) || null)} />
          <Button theme="primary" icon={<FilterIcon />}>筛选</Button>
        </div>
      </Card>

      <Card bordered>
        <Table
          data={data?.rows || []}
          columns={columns}
          loading={isLoading}
          rowKey="id"
          maxHeight={520}
          bordered
          stripe
          hover
          size="small"
          empty="暂无事件数据，请确保混天DB已启动并写入数据"
          pagination={{ defaultPageSize: 50, pageSizeOptions: [20, 50, 100, 200], showJumper: true }}
        />
      </Card>
    </div>
  );
}
