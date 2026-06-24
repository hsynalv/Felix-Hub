import { apiGet } from "./api-client";

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
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.tool) params.set("tool", opts.tool);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.offset) params.set("offset", String(opts.offset));
  const q = params.toString();
  return apiGet<{ events: UsageEvent[]; total: number }>(`/usage/events${q ? `?${q}` : ""}`);
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
