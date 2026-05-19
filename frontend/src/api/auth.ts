import api from "./client";
import type { LoginRequest, LoginResponse } from "@/types/api";

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/auth/login", req);
  return data;
}

export async function logout(): Promise<void> {
  localStorage.removeItem("huntiandb_token");
  localStorage.removeItem("huntiandb_user");
}
