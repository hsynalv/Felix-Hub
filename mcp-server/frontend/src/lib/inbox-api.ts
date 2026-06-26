import { apiGet, apiPost } from "./api-client";

export type InboxItemType =
  | "approval"
  | "run_failed"
  | "run_waiting"
  | "run_active"
  | "sla_violation"
  | "watcher_fired"
  | "watcher_alert";

export interface InboxItem {
  id: string;
  type: InboxItemType;
  priority: "critical" | "high" | "normal" | "low";
  title: string;
  message: string;
  runId: string | null;
  projectId: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
  actions: string[];
  readAt: string | null;
  snoozedUntil: string | null;
  unread: boolean;
  snoozed: boolean;
}

export interface InboxSummary {
  total: number;
  unreadCount: number;
  byType: Record<string, number>;
}

export async function fetchInboxItems(params?: { includeRead?: boolean; types?: string }) {
  const qs = new URLSearchParams();
  if (params?.includeRead === false) qs.set("includeRead", "false");
  if (params?.types) qs.set("types", params.types);
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiGet<{ items: InboxItem[]; count: number; unreadCount: number }>(`/inbox/items${suffix}`);
}

export async function fetchInboxSummary() {
  return apiGet<InboxSummary>("/inbox/summary");
}

export async function markInboxRead(itemId: string) {
  return apiPost<{ itemId: string }>(`/inbox/items/${encodeURIComponent(itemId)}/read`, {});
}

export async function snoozeInboxItem(itemId: string, minutes = 60) {
  return apiPost<{ snoozedUntil: string }>(`/inbox/items/${encodeURIComponent(itemId)}/snooze`, { minutes });
}

export interface ObsProDashboard {
  windowDays: number;
  runs: { total: number; completed: number; failed: number; waitingApproval: number };
  failureHotspots: Array<{ tool: string; calls: number; fails: number; failRate: number }>;
  approvalBottlenecks: Array<{ tool: string; pendingCount: number }>;
  approvalQueue: { pending: number; oldestPendingHours: number };
  reliabilityTrend: Array<{ date: string; completed: number; failed: number; total: number }>;
  costHotspots: Array<{ tool: string; costUsd: number }>;
  totalCostUsd: number;
  slaViolations: number;
}

export async function fetchObservabilityProDashboard(days = 7) {
  return apiGet<ObsProDashboard>(`/observability-pro/dashboard?days=${days}`);
}
