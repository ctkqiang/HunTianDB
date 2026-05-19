import api from "./client";
import type { QueryRequest, QueryResponse } from "@/types/api";

export async function queryEvents(req: QueryRequest): Promise<QueryResponse> {
  const { data } = await api.post<QueryResponse>("/query", req);
  return data;
}

export async function getSnapshots(): Promise<string[]> {
  const { data } = await api.get<string[]>("/snapshots");
  return data;
}
