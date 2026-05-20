import { useQuery } from "@tanstack/react-query";
import { queryEvents } from "@/api/events";
import { useFilterStore } from "@/store/filterStore";

/**
 * 安全事件数据查询 Hook — 基于 TanStack Query 的自动轮询机制。
 *
 * 每4秒自动刷新事件列表，根据当前筛选条件动态构建 SQL 查询语句。
 * 返回的 `data` 对象包含列定义和行数据，可直接传入 Table 组件渲染。
 *
 * @returns TanStack Query 结果对象，包含 `data`、`isLoading`、`refetch` 等字段。
 */
export function useEvents() {
  const userId = useFilterStore((s) => s.userId);
  const zone = useFilterStore((s) => s.zone);
  const eventType = useFilterStore((s) => s.eventType);
  const timeRange = useFilterStore((s) => s.timeRange);

  return useQuery({
    queryKey: ["events", { userId, zone, eventType, timeRange }],
    queryFn: () => {
      let sql = "SELECT * FROM events WHERE 1=1";
      if (userId) sql += ` AND user_id = ${userId}`;
      if (zone) sql += ` AND zone = ${zone}`;
      if (eventType) sql += ` AND event_type = ${eventType}`;
      if (timeRange) sql += ` AND timestamp BETWEEN ${timeRange[0]} AND ${timeRange[1]}`;
      sql += " ORDER BY timestamp DESC LIMIT 100";
      return queryEvents({ sql });
    },
    staleTime: 3000,
    refetchInterval: 4000,
  });
}
