export interface QueryRequest {
  sql: string;
  params?: string[];
}

export interface QueryResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  elapsedMs: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  uptimeSeconds: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  role: string;
}
