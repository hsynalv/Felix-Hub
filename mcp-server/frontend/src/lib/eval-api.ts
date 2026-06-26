import { apiGet, apiPost } from "./api-client";

export interface GoldenTrace {
  id: string;
  file?: string;
  templateId: string;
  goal?: string | null;
  stepCount: number;
  parameters?: Record<string, unknown>;
}

export interface RegressionResult {
  pass: boolean;
  summary: { total: number; passed: number; failed: number };
  results: Array<{ id: string; templateId: string; pass: boolean; diffs: unknown[] }>;
  generatedAt: string;
}

export interface TemplateEvalResult {
  pass: boolean;
  templateId: string;
  plan?: { phaseCount: number; tools: string[] };
  comparison?: { pass: boolean; diffs: unknown[]; expectedCount: number; actualCount: number };
  error?: { code: string; message: string };
}

export async function fetchGoldenTraces() {
  return apiGet<{ traces: GoldenTrace[]; count: number }>("/eval/golden");
}

export async function fetchGoldenTrace(id: string) {
  return apiGet<Record<string, unknown>>(`/eval/golden/${encodeURIComponent(id)}`);
}

export async function runRegressionSuite() {
  return apiPost<RegressionResult>("/eval/regression", {});
}

export async function evalTemplate(templateId: string, parameters: Record<string, unknown> = {}) {
  return apiPost<TemplateEvalResult>(`/eval/template/${encodeURIComponent(templateId)}`, { parameters });
}

export async function evalRun(runId: string, goldenId?: string) {
  return apiPost<{ pass: boolean; comparison?: unknown }>(`/eval/runs/${encodeURIComponent(runId)}`, {
    goldenId,
  });
}

export async function evalReplayCompare(runId: string, dryRun = true) {
  return apiPost<{ pass: boolean; replayRunId?: string; comparison?: unknown }>(
    `/eval/runs/${encodeURIComponent(runId)}/replay-compare`,
    { dryRun }
  );
}
