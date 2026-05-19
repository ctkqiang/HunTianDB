import { useQuery } from "@tanstack/react-query";
import { queryEvents } from "@/api/events";
import { useFilterStore } from "@/store/filterStore";

export function useEvents() {
  const filters = useFilterStore();

  return useQuery({
    queryKey: ["events", filters],
    queryFn: () => {
      let sql = "SELECT * FROM events WHERE 1=1";
      if (filters.userId) sql += ` AND user_id = ${filters.userId}`;
      if (filters.zone) sql += ` AND zone = ${filters.zone}`;
      if (filters.eventType) sql += ` AND event_type = ${filters.eventType}`;
      if (filters.timeRange) sql += ` AND timestamp BETWEEN ${filters.timeRange[0]} AND ${filters.timeRange[1]}`;
      sql += " ORDER BY timestamp DESC LIMIT 100";
      return queryEvents({ sql });
    },
    staleTime: 5000,
  });
}
