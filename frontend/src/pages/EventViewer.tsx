import { Card, Table, Tag, Input, Select, Space, Button } from "tdesign-react";
import { RefreshIcon, DownloadIcon, FilterIcon } from "tdesign-icons-react";
import { useEvents } from "@/hooks/useEvents";
import { useFilterStore } from "@/store/filterStore";
import { useT } from "@/i18n/useT";

const TYPE: Record<number, string> = { 1: "认证", 2: "授权", 3: "数据访问", 4: "配置变更", 5: "锁获取", 6: "锁释放", 7: "金融", 8: "错误" };

export function EventViewer() {
  const { data, isLoading, refetch } = useEvents();
  const filters = useFilterStore(); const { t } = useT();

  const cols = [
    { colKey: "id", title: "ID", width: 80, sorter: true },
    { colKey: "timestamp", title: "时间", width: 170, cell: ({ row }: any) => <span style={{ fontSize: 12 }}>{new Date(row.timestamp).toLocaleString("zh-CN")}</span> },
    { colKey: "user_id", title: "用户", width: 70 },
    { colKey: "event_type", title: "类型", width: 90, cell: ({ row }: any) => <Tag size="small" variant="light">{TYPE[row.event_type] ?? row.event_type}</Tag> },
    { colKey: "zone", title: "分区", width: 55 },
    { colKey: "status_code", title: "状态", width: 65, cell: ({ row }: any) => <Tag size="small" variant="light" theme={row.status_code < 300 ? "success" : "danger"}>{row.status_code}</Tag> },
    { colKey: "session_id", title: "会话", width: 100, ellipsis: true },
    { colKey: "error_msg", title: "错误", width: 120, ellipsis: true, cell: ({ row }: any) => row.error_msg ? <span style={{ color: "var(--td-error-color)", fontSize: 12 }}>{row.error_msg}</span> : <span style={{ color: "var(--td-text-color-placeholder)" }}>—</span> },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div><h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t("event_viewer")}</h2></div>
        <Space><Button icon={<RefreshIcon />} variant="outline" onClick={() => refetch()}>{t("refresh")}</Button><Button icon={<DownloadIcon />} variant="outline">{t("export")}</Button></Space>
      </div>

      <Card bordered style={{ marginBottom: 16 }}>
        <Space style={{ width: "100%" }} size={10}>
          <Input placeholder="用户ID" style={{ width: 100 }} onChange={(v) => filters.setUserId(Number(v) || null)} />
          <Select placeholder="事件类型" style={{ width: 110 }} clearable options={Object.entries(TYPE).map(([k, v]) => ({ label: v, value: Number(k) }))} onChange={(v) => filters.setEventType(v as number ?? null)} />
          <Input placeholder="分区" style={{ width: 80 }} onChange={(v) => filters.setZone(Number(v) || null)} />
          <Button theme="primary" icon={<FilterIcon />}>{t("filter")}</Button>
        </Space>
      </Card>

      <Card bordered>
        <Table data={data?.rows ?? []} columns={cols} loading={isLoading} rowKey="id" maxHeight={520} bordered stripe hover size="small" empty={t("no_events")} pagination={{ defaultPageSize: 50, pageSizeOptions: [20, 50, 100], showJumper: true }} />
      </Card>
    </div>
  );
}
