import api from "./client";
import type { QueryRequest, QueryResponse } from "@/types/api";

export async function queryEvents(req: QueryRequest): Promise<QueryResponse> {
  const { data } = await api.post<QueryResponse>("/query", req);
  return data;
}

export async function checkHealth(): Promise<boolean> {
  try {
    await api.get("/health", { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export async function getSnapshots(): Promise<string[]> {
  const { data } = await api.get<string[]>("/snapshots");
  return data;
}
