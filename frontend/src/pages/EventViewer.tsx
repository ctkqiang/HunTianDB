import { useState } from "react";
import { Card, Table, Tag, Input, Select, Space, Button } from "tdesign-react";
import { SearchIcon, RefreshIcon, FilterIcon } from "tdesign-icons-react";
import { useEvents } from "@/hooks/useEvents";
import { useFilterStore } from "@/store/filterStore";
import { EventTypeLabels } from "@/types/event";

export function EventViewer() {
  const { data, isLoading, refetch } = useEvents();
  const filters = useFilterStore();
  const [sql, setSql] = useState("");

  const columns = [
    { colKey: "id", title: "ID", width: 80 },
    { colKey: "timestamp", title: "时间", width: 180 },
    { colKey: "user_id", title: "用户", width: 80 },
    {
      colKey: "event_type", title: "类型", width: 100,
      cell: ({ row }: any) => (
        <Tag size="small" theme="primary" variant="light">
          {EventTypeLabels[row.event_type] || row.event_type}
        </Tag>
      ),
    },
    { colKey: "zone", title: "分区", width: 60 },
    { colKey: "region", title: "区域", width: 60 },
    { colKey: "status_code", title: "状态码", width: 80 },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">事件查看器</h2>
        <Space>
          <Button icon={<RefreshIcon />} variant="outline" onClick={() => refetch()}>
            刷新
          </Button>
        </Space>
      </div>

      <Card bordered className="mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input
            value={sql}
            onChange={(v) => setSql(v as string)}
            placeholder="SELECT * FROM events WHERE ..."
            prefixIcon={<SearchIcon />}
            style={{ flex: 1, minWidth: 300 }}
          />
          <Input
            placeholder="用户ID"
            style={{ width: 120 }}
            onChange={(v) => filters.setUserId(Number(v) || null)}
          />
          <Select
            placeholder="事件类型"
            style={{ width: 120 }}
            clearable
            options={Object.entries(EventTypeLabels).map(([k, v]) => ({ label: v, value: Number(k) }))}
            onChange={(v) => filters.setEventType(v as number || null)}
          />
          <Button theme="primary" icon={<FilterIcon />}>查询</Button>
        </div>
      </Card>

      <Card bordered>
        <Table
          data={data?.rows || []}
          columns={columns}
          loading={isLoading}
          rowKey="id"
          maxHeight={500}
          empty="暂无事件数据，请先连接混天DB并写入数据"
        />
      </Card>
    </div>
  );
}
