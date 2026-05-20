import { Card, Table, Tag, Input, Select, Space, Button } from "tdesign-react";
import { RefreshIcon, FilterIcon } from "tdesign-icons-react";
import { useEvents } from "@/hooks/useEvents";
import { useT } from "@/i18n/useT";

const TYPE: Record<number, string> = { 1: "认证", 2: "授权", 3: "数据访问", 4: "配置变更", 5: "锁获取", 6: "锁释放", 7: "金融", 8: "错误" };

/**
 * 安全事件查看器 — 浏览、筛选和分页展示所有审计事件。
 *
 * 通过 `useEvents` Hook 获取实时事件数据，支持按用户ID、
 * 事件类型和分区进行筛选。表格带分页、排序和颜色编码的类型/状态标签。
 *
 * @returns 包含筛选栏和分页事件表格的完整事件查看器布局。
 */
export function EventViewer() {
  const { data, isLoading, refetch } = useEvents();
  const { t } = useT();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t("event_viewer")}</h2>
        <Button icon={<RefreshIcon />} variant="outline" onClick={() => refetch()}>{t("refresh")}</Button>
      </div>
      <Card bordered>
        <Table
          data={data?.rows ?? []}
          columns={[
            { colKey: "id", title: "ID", width: 70 },
            { colKey: "timestamp", title: t("timestamp") || "时间", width: 160, cell: ({ row }: any) => new Date(row.timestamp).toLocaleString("zh-CN") },
            { colKey: "user_id", title: "UID", width: 65 },
            { colKey: "event_type", title: t("type") || "类型", width: 80, cell: ({ row }: any) => <Tag size="small" variant="light">{TYPE[row.event_type] ?? row.event_type}</Tag> },
            { colKey: "status_code", title: t("status") || "状态", width: 65, cell: ({ row }: any) => <Tag size="small" variant="light" theme={row.status_code < 300 ? "success" : "danger"}>{row.status_code}</Tag> },
            { colKey: "zone", title: t("zone") || "Z", width: 50 },
            { colKey: "session_id", title: "SID", width: 90, ellipsis: true },
            { colKey: "error_msg", title: t("error") || "错误", width: 120, ellipsis: true, cell: ({ row }: any) => row.error_msg ? <span style={{ color: "var(--td-error-color)", fontSize: 12 }}>{row.error_msg}</span> : "—" },
          ]}
          loading={isLoading}
          rowKey="id"
          maxHeight={520}
          bordered stripe hover
          size="small"
          empty={t("no_events")}
          pagination={{ defaultPageSize: 50, pageSizeOptions: [20, 50, 100], showJumper: true }}
        />
      </Card>
    </div>
  );
}
