import { useQuery } from "@tanstack/react-query";
import { queryEvents } from "@/api/events";
import { useFilterStore } from "@/store/filterStore";

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
