import { apiGet, apiPatch, apiPost, apiPut } from "./api-client";

export interface IntentTrainConfig {
  nlpRuntimeEnabled: boolean;
  collectEnabled: boolean;
  pipelineEnabled: boolean;
  llmLabelingEnabled: boolean;
  trainLlm: { provider: string; model: string };
  scheduleHours: number;
  minPendingForTrain: number;
  nlpConfidenceThreshold: number;
  runtimeLlmFallback: boolean;
  requireHumanOnDisagreement: boolean;
}

export interface IntentTrainingStatus {
  activeVersion: number | null;
  corpusSize: number;
  counts: { pending: number; disagreement: number; confirmed: number; total: number };
  samplesToday: number;
  lastModel: {
    version: number;
    corpusCount: number;
    evalAccuracy: number | null;
    promotedAt?: string;
  } | null;
  config: IntentTrainConfig;
  intents: string[];
}

export interface IntentSample {
  id: string;
  userMessage: string;
  predictedIntent: string;
  predictedConfidence: number;
  predictionSource: string;
  llmSuggestedIntent?: string | null;
  labelStatus: string;
  toolsUsed?: string[];
  guardBlocks?: unknown[];
  labelReason?: string | null;
  createdAt?: string;
}

export interface PipelineStep {
  id: string;
  status: string;
  count?: number;
  jobId?: string;
  lastRunAt?: string;
  version?: number;
}

export async function fetchIntentTrainingStatus() {
  return apiGet<IntentTrainingStatus>("/admin/intent-training/status");
}

export async function fetchIntentTrainingConfig() {
  return apiGet<IntentTrainConfig>("/admin/intent-training/config");
}

export async function updateIntentTrainingConfig(config: Partial<IntentTrainConfig>) {
  return apiPut<IntentTrainConfig>("/admin/intent-training/config", config);
}

export async function fetchIntentMetrics() {
  return apiGet<{
    corpusByIntent: Record<string, number>;
    predictionsLast7d: Record<string, number>;
    samplesToday: number;
    disagreementCount: number;
  }>("/admin/intent-training/metrics");
}

export async function fetchIntentPipeline() {
  return apiGet<{ pipelineEnabled: boolean; collectEnabled: boolean; steps: PipelineStep[] }>(
    "/admin/intent-training/pipeline"
  );
}

export async function fetchIntentModels() {
  return apiGet<
    Array<{
      version: number;
      corpusCount: number;
      evalAccuracy: number | null;
      evalReport?: Record<string, unknown> | null;
      promotedAt?: string;
    }>
  >("/admin/intent-training/models");
}

export async function fetchIntentSamples(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiGet<IntentSample[]>(`/admin/intent-training/samples${q}`);
}

export async function fetchIntentCorpus(intent?: string) {
  const q = intent ? `?intent=${encodeURIComponent(intent)}` : "";
  return apiGet<Array<{ intent: string; utterance: string; locale: string; source: string }>>(
    `/admin/intent-training/corpus${q}`
  );
}

export async function classifyPlayground(message: string) {
  return apiPost<{
    regex: { intent: string; confidence: number };
    nlp: { intent: string; confidence: number } | null;
    merged: { intent: string; confidence: number; source: string };
  }>("/admin/intent-training/playground/classify", { message });
}

export async function triggerLabelJob() {
  return apiPost<{ id: string }>("/admin/intent-training/jobs/label", {});
}

export async function triggerTrainJob() {
  return apiPost<{ id: string }>("/admin/intent-training/jobs/train", {});
}

export async function reloadIntentModel() {
  return apiPost<{ version: number | null }>("/admin/intent-training/reload-model", {});
}

export async function rollbackIntentModel(version: number) {
  return apiPost<{ version: number }>("/admin/intent-training/jobs/rollback", { version });
}

export async function resolveDisagreement(
  id: string,
  body: { choice?: "runtime" | "llm" | "custom"; customIntent?: string; reject?: boolean }
) {
  return apiPatch<{ status: string; intent?: string }>(
    `/admin/intent-training/samples/${id}/resolve-disagreement`,
    body
  );
}

export async function patchIntentSample(id: string, body: { intent?: string; reject?: boolean }) {
  return apiPatch<IntentSample>(`/admin/intent-training/samples/${id}`, body);
}

export async function addCorpusUtterance(intent: string, utterance: string, locale = "tr") {
  return apiPost("/admin/intent-training/corpus", { intent, utterance, locale });
}

export async function fetchIntentJob(id: string) {
  return apiGet<{ id: string; state: string; progress: number; error?: string }>(
    `/admin/intent-training/jobs/${id}`
  );
}
