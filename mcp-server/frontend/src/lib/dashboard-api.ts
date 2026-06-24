import { apiGet, apiGetRaw } from "./api-client";
export interface BrainDashboardStats {
  memories?: { total?: number; byType?: Record<string, number> };
  projects?: { total?: number };
}

export async function fetchBrainDashboardStats() {
  return apiGet<BrainDashboardStats>("/brain/stats");
}
import { fetchEnvCatalog } from "./settings-api";
import { listConversations } from "./conversations-api";

export interface AuditStats {
  total: number;
  errors: number;
  byPlugin: Record<
    string,
    { total: number; success: number; client_error: number; server_error: number; avgDuration: number }
  >;
}

export interface AuditOperation {
  timestamp: string;
  plugin: string;
  operation: string;
  success: boolean;
  durationMs?: number;
  actor?: string;
}

export interface ObsHealthData {
  status?: string;
  uptime?: { seconds?: number; human?: string };
  memory?: { heapUsedMb?: number; rssMb?: number; heapTotalMb?: number };
  plugins?: Array<{ name: string; status?: string; calls?: number; errors?: number }>;
}

export interface JobStats {
  total?: number;
  queued?: number;
  running?: number;
  completed?: number;
  failed?: number;
  cancelled?: number;
}

export async function fetchAuditStats() {
  const data = await apiGet<{ stats: AuditStats }>("/audit/stats");
  return data.stats;
}

export async function fetchRecentOperations(limit = 8) {
  const data = await apiGet<{ entries: AuditOperation[]; count: number }>(
    `/audit/operations?limit=${limit}`
  );
  return data.entries ?? [];
}

export async function fetchObsHealth() {
  return apiGet<ObsHealthData>("/observability/health");
}

export async function fetchJobStats() {
  const raw = await apiGetRaw<{ stats?: JobStats; data?: { stats?: JobStats } }>("/jobs/stats");
  return raw.stats ?? raw.data?.stats ?? {};
}

export async function fetchPendingApprovals() {
  const raw = await apiGetRaw<{
    approvals?: Array<{ id?: string; tool?: string; toolName?: string }>;
    data?: { approvals?: Array<{ id?: string; tool?: string; toolName?: string }> };
  }>("/approvals/pending");
  return raw.approvals ?? raw.data?.approvals ?? [];
}

export async function fetchDashboardBundle() {
  const [
    auditStats,
    operations,
    obsHealth,
    jobStats,
    brainStats,
    envCatalog,
    conversations,
    approvals,
  ] = await Promise.allSettled([
    fetchAuditStats(),
    fetchRecentOperations(10),
    fetchObsHealth(),
    fetchJobStats(),
    fetchBrainDashboardStats(),
    fetchEnvCatalog(),
    listConversations(6),
    fetchPendingApprovals(),
  ]);

  return {
    auditStats: auditStats.status === "fulfilled" ? auditStats.value : null,
    operations: operations.status === "fulfilled" ? operations.value : [],
    obsHealth: obsHealth.status === "fulfilled" ? obsHealth.value : null,
    jobStats: jobStats.status === "fulfilled" ? jobStats.value : null,
    brainStats: brainStats.status === "fulfilled" ? brainStats.value : null,
    envCatalog: envCatalog.status === "fulfilled" ? envCatalog.value : null,
    conversations: conversations.status === "fulfilled" ? conversations.value : [],
    approvals: approvals.status === "fulfilled" ? approvals.value : [],
  };
}
