import { apiGet, apiPost } from "./api-client";

export interface ApprovalItem {
  id: string;
  toolName?: string | null;
  path?: string | null;
  riskLevel?: string | null;
  riskScore?: number;
  runId?: string | null;
  status: string;
  body?: unknown;
  createdAt?: string;
}

export interface ApprovalDetail extends ApprovalItem {
  riskBreakdown?: { riskLevel?: string; protectedTool?: boolean; score?: number };
  run?: { id: string; goal?: string; status: string; projectId?: string | null };
  priorStepOutput?: unknown;
}

export type ApprovalDecision = "approve_once" | "approve_project" | "deny";

export async function listPendingApprovals() {
  return apiGet<{ approvals: ApprovalItem[]; count: number }>("/approvals/pending");
}

export async function getApprovalDetail(id: string) {
  return apiGet<ApprovalDetail>(`/approvals/${id}`);
}

export async function decideApproval(id: string, decision: ApprovalDecision, reason?: string) {
  return apiPost<{ decision: string; outcome?: unknown }>(`/approvals/${id}/decide`, { decision, reason });
}

export async function listApprovalHistory(limit = 50) {
  return apiGet<{ approvals: ApprovalItem[]; count: number }>(`/approvals/history?limit=${limit}`);
}
