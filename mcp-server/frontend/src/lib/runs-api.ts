import { apiGet, apiPost } from "./api-client";

export type RunStatus =
  | "pending"
  | "running"
  | "waiting_approval"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface AgentRun {
  id: string;
  projectId?: string | null;
  conversationId?: string | null;
  goal?: string | null;
  status: RunStatus;
  currentStep: number;
  stepCount?: number;
  createdBy?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  error?: { code?: string; message?: string } | null;
  usage?: {
    callCount?: number;
    totalTokens?: number;
    estimatedCostUsd?: number;
  } | null;
  stepUsage?: Array<{
    stepIndex: number;
    type?: string;
    toolName?: string | null;
    status?: string;
    durationMs?: number | null;
    usage?: {
      totalTokens?: number;
      estimatedCostUsd?: number;
      promptTokens?: number;
      completionTokens?: number;
    } | null;
  }>;
}

export interface RunStep {
  id: string;
  runId: string;
  stepIndex: number;
  type: "llm" | "tool" | "approval" | "system";
  toolName?: string | null;
  status: string;
  input?: unknown;
  output?: unknown;
  durationMs?: number | null;
  usage?: {
    totalTokens?: number;
    estimatedCostUsd?: number;
    promptTokens?: number;
    completionTokens?: number;
  } | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
}

export async function listRuns(params?: {
  status?: string;
  projectId?: string;
  conversationId?: string;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.projectId) q.set("projectId", params.projectId);
  if (params?.conversationId) q.set("conversationId", params.conversationId);
  if (params?.limit) q.set("limit", String(params.limit));
  const path = `/runs${q.toString() ? `?${q}` : ""}`;
  return apiGet<{ runs: AgentRun[]; count: number }>(path);
}

export async function getRun(runId: string) {
  return apiGet<AgentRun>(`/runs/${runId}`);
}

export async function getRunSteps(runId: string, limit = 100) {
  return apiGet<{ steps: RunStep[]; count: number }>(`/runs/${runId}/steps?limit=${limit}`);
}

export async function pauseRun(runId: string) {
  return apiPost<AgentRun>(`/runs/${runId}/pause`, {});
}

export async function retryRunStep(runId: string, stepIndex?: number) {
  return apiPost<{ run: AgentRun; jobId?: string; stepIndex: number }>(`/runs/${runId}/retry-step`, {
    stepIndex,
  });
}

export async function rollbackRun(runId: string, dryRun = true) {
  return apiPost<{ runId: string; compensated: number; dryRun: boolean }>(`/runs/${runId}/rollback`, {
    dryRun,
  });
}

export async function compareRun(runId: string, targetRunId?: string, dryRun = true) {
  return apiPost<{ comparison?: unknown; replayRunId?: string }>(`/runs/${runId}/compare`, {
    targetRunId,
    dryRun,
  });
}

export async function cancelRun(runId: string, reason?: string) {
  return apiPost<AgentRun>(`/runs/${runId}/cancel`, { reason });
}

export async function resumeRun(runId: string, startFromStep?: number) {
  return apiPost<AgentRun & { jobId?: string; resumed?: boolean }>(`/runs/${runId}/resume`, {
    startFromStep,
  });
}

export async function retryRun(runId: string, stepIndex?: number) {
  return retryRunStep(runId, stepIndex);
}

export async function approveRun(runId: string, approvalId: string, approved = true) {
  return apiPost<{ status: string; via?: string }>(`/runs/${runId}/approve`, {
    approval_id: approvalId,
    approved,
  });
}

export async function replayRun(runId: string, dryRun = true) {
  return apiPost<AgentRun>(`/runs/${runId}/replay`, { dryRun });
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  stepCount: number;
  parameters: Array<{ name: string; required?: boolean; description?: string; default?: string }>;
}

export async function listWorkflowTemplates() {
  return apiGet<{ templates: WorkflowTemplate[] }>("/runs/templates/list");
}

export async function startWorkflowTemplate(
  templateId: string,
  parameters: Record<string, string>,
  dryRun = false
) {
  return apiPost<AgentRun & { jobId?: string }>(`/runs/from-template/${templateId}`, {
    parameters,
    dryRun,
    async: true,
  });
}
