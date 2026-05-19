import { Card, Table, Tag, Input, Select, Space, Button } from "tdesign-react";
import { RefreshIcon, DownloadIcon, FilterIcon } from "tdesign-icons-react";
import { useEvents } from "@/hooks/useEvents";
import { useFilterStore } from "@/store/filterStore";
import { useT } from "@/i18n/useT";

const TYPE: Record<number, string> = { 1: "认证", 2: "授权", 3: "数据访问", 4: "配置变更", 5: "锁获取", 6: "锁释放", 7: "金融", 8: "错误" };

export function EventViewer() {
  const { data, isLoading, refetch } = useEvents();
  const filters = useFilterStore();
  const { t } = useT();

  const cols = [
    { colKey: "id", title: "ID", width: 70, sorter: true },
    { colKey: "timestamp", title: t("timestamp") || "时间", width: 160, cell: ({ row }: any) => <span className="fs12">{new Date(row.timestamp).toLocaleString("zh-CN")}</span> },
    { colKey: "user_id", title: "UID", width: 60 },
    { colKey: "event_type", title: t("type") || "类型", width: 80, cell: ({ row }: any) => <Tag size="small" variant="light">{TYPE[row.event_type] ?? row.event_type}</Tag> },
    { colKey: "zone", title: t("zone") || "分区", width: 55 },
    { colKey: "status_code", title: t("status") || "状态", width: 65, cell: ({ row }: any) => <Tag size="small" variant="light" theme={row.status_code < 300 ? "success" : "danger"}>{row.status_code}</Tag> },
    { colKey: "session_id", title: "SID", width: 90, ellipsis: true },
    { colKey: "error_msg", title: t("error") || "错误", width: 120, ellipsis: true, cell: ({ row }: any) => row.error_msg ? <span className="fs12" style={{ color: "var(--td-error-color)" }}>{row.error_msg}</span> : <span className="c-muted">—</span> },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t("event_viewer")}</h2>
        <Space>
          <Button icon={<RefreshIcon />} variant="outline" onClick={() => refetch()}>{t("refresh")}</Button>
          <Button icon={<DownloadIcon />} variant="outline">{t("export")}</Button>
        </Space>
      </div>

      <Card bordered style={{ marginBottom: 16 }}>
        <Space style={{ width: "100%" }} size={10}>
          <Input placeholder="UID" style={{ width: 90 }} onChange={(v) => filters.setUserId(Number(v) || null)} />
          <Select placeholder={t("type") || "类型"} style={{ width: 110 }} clearable options={Object.entries(TYPE).map(([k, v]) => ({ label: v, value: Number(k) }))} onChange={(v) => filters.setEventType(v as number ?? null)} />
          <Input placeholder={t("zone") || "分区"} style={{ width: 80 }} onChange={(v) => filters.setZone(Number(v) || null)} />
          <Button theme="primary" icon={<FilterIcon />}>{t("filter")}</Button>
        </Space>
      </Card>

      <Card bordered>
        <Table data={data?.rows ?? []} columns={cols} loading={isLoading} rowKey="id" maxHeight={520} bordered stripe hover size="small" empty={t("no_events")} pagination={{ defaultPageSize: 50, pageSizeOptions: [20, 50, 100], showJumper: true }} />
      </Card>
    </div>
  );
}
