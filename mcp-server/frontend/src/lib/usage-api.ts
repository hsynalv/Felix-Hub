import { apiGet, apiPut } from "./api-client";

export interface UsageGroup {
  key: string;
  callCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface UsageEvent {
  id: number;
  eventId: string;
  occurredAt: string;
  source: string;
  channel?: string | null;
  toolName?: string | null;
  pluginName?: string | null;
  operationType: string;
  provider?: string | null;
  model?: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number | null;
  runId?: string | null;
  projectId?: string | null;
}

export interface UsageTotals {
  callCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface UsageQuota {
  id: string;
  scopeType: string;
  scopeId: string;
  period: string;
  limitTokens?: number | null;
  limitUsd?: number | null;
  alertThreshold: number;
  hardStop: boolean;
  enabled: boolean;
}

export interface QuotaCheckResult {
  allowed: boolean;
  warning?: boolean;
  reason?: string;
  usage?: UsageTotals;
  quota?: UsageQuota;
}

export interface UsageStats {
  days: number;
  callCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  byTool: UsageGroup[];
}

export type UsageGroupBy = "tool" | "model" | "source" | "day" | "plugin";

export async function fetchUsageSummary(opts: {
  from?: string;
  to?: string;
  groupBy?: UsageGroupBy;
}) {
  const params = new URLSearchParams();
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.groupBy) params.set("groupBy", opts.groupBy);
  const q = params.toString();
  return apiGet<{ groups: UsageGroup[] }>(`/usage/summary${q ? `?${q}` : ""}`);
}

export async function fetchUsageEvents(opts: {
  from?: string;
  to?: string;
  tool?: string;
  runId?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.tool) params.set("tool", opts.tool);
  if (opts.runId) params.set("runId", opts.runId);
  if (opts.projectId) params.set("projectId", opts.projectId);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.offset) params.set("offset", String(opts.offset));
  const q = params.toString();
  return apiGet<{ events: UsageEvent[]; total: number }>(`/usage/events${q ? `?${q}` : ""}`);
}

export async function fetchRunUsage(runId: string) {
  return apiGet<{ runId: string; events: UsageEvent[]; totals: UsageTotals | null }>(
    `/usage/runs/${encodeURIComponent(runId)}`
  );
}

export async function fetchProjectUsage(projectId: string, days = 30) {
  return apiGet<{ projectId: string; days: number; events: UsageEvent[]; totals: UsageTotals }>(
    `/usage/projects/${encodeURIComponent(projectId)}?days=${days}`
  );
}

export async function fetchUsageQuotas() {
  return apiGet<{ quotas: UsageQuota[] }>("/usage/quotas");
}

export async function upsertUsageQuota(body: {
  scopeType?: string;
  scopeId?: string;
  period?: string;
  limitTokens?: number | null;
  limitUsd?: number | null;
  alertThreshold?: number;
  hardStop?: boolean;
}) {
  return apiPut<UsageQuota>("/usage/quotas", body);
}

export async function checkProjectQuota(projectId: string) {
  return apiGet<QuotaCheckResult>(`/usage/quotas/check?projectId=${encodeURIComponent(projectId)}`);
}

export async function fetchUsageStats(days = 7) {
  return apiGet<UsageStats>(`/usage/stats?days=${days}`);
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function usageRangePresets() {
  const now = new Date().toISOString();
  return {
    d7: { from: isoDaysAgo(7), to: now, label: "7 gün" },
    d30: { from: isoDaysAgo(30), to: now, label: "30 gün" },
    d90: { from: isoDaysAgo(90), to: now, label: "90 gün" },
  };
}

export function formatTokenCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatCostUsd(n: number) {
  if (n < 0.01) return `~$${n.toFixed(4)}`;
  return `~$${n.toFixed(2)}`;
}
