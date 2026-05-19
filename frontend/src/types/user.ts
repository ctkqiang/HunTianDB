export type Role = "admin" | "auditor" | "writer" | "reader";

export interface User {
  id: string;
  username: string;
  role: Role;
  token: string;
}

export const RoleLabels: Record<Role, string> = {
  admin: "管理员", auditor: "审计员", writer: "写入者", reader: "只读",
};
