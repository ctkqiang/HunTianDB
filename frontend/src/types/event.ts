/** 安全审计事件 — 混天DB 核心数据结构 */
export interface SecurityEvent {
  id: number;
  timestamp: string;
  userId: number;
  sessionId: number;
  eventType: number;
  lockId: number;
  zone: number;
  region: number;
  statusCode: number;
  ipAddress: number;
  parentEventId: number;
  errorMsg?: string;
  metadataJson?: string;
}

export type EventType =
  | "auth" | "authorize" | "data_access"
  | "config_change" | "lock_acquire" | "lock_release"
  | "financial" | "error";

export const EventTypeLabels: Record<number, string> = {
  1: "认证", 2: "授权", 3: "数据访问", 4: "配置变更",
  5: "锁获取", 6: "锁释放", 7: "金融交易", 8: "错误",
};
