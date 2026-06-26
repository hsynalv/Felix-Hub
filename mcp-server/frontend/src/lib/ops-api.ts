import { apiGet, apiPost, apiPut } from "./api-client";

export interface Runbook {
  id: string;
  name: string;
  type: string;
  templateId: string;
  owner: string;
  version: number;
  slaMinutes: number;
  autonomyLevel: string;
  description: string;
  enabled: boolean;
  builtin: boolean;
  readonly: boolean;
  requiredApprovals: string[];
  preflightChecks: string[];
}

export interface ScheduleSkipIf {
  type: string;
}

export interface Schedule {
  id: string;
  name: string;
  runbookId: string | null;
  templateId: string | null;
  cronExpr: string;
  timezone: string;
  projectId: string | null;
  projectEnv: string;
  maxCostUsd: number;
  autonomyLevel: string;
  skipIf?: ScheduleSkipIf | null;
  enabled: boolean;
  paused: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastOutcome: string | null;
}

export interface AutonomyMatrix {
  projectId: string | null;
  default: string | null;
  envs: Record<string, string>;
  levels: string[];
  descriptions: Record<string, string>;
}

export interface PreflightResult {
  allowed: boolean;
  blocked: boolean;
  requiresApproval: boolean;
  warnings: string[];
  report?: { summary: string; outcome: string };
}

export async function fetchRunbooks() {
  return apiGet<{ runbooks: Runbook[]; count: number }>("/ops/runbooks");
}

export async function preflightRunbook(id: string, parameters: Record<string, unknown> = {}) {
  return apiPost<PreflightResult>(`/ops/runbooks/${encodeURIComponent(id)}/preflight`, { parameters });
}

export async function executeRunbook(id: string, parameters: Record<string, unknown> = {}, dryRun = false) {
  return apiPost<{ started: boolean; outcome: string; run?: { id: string }; postRunReport?: { summary: string } }>(
    `/ops/runbooks/${encodeURIComponent(id)}/execute`,
    { parameters, dryRun }
  );
}

export async function fetchSchedules() {
  return apiGet<{ schedules: Schedule[]; count: number }>("/ops/schedules");
}

export async function createSchedule(body: Partial<Schedule> & { cronExpr: string; name: string }) {
  return apiPost<Schedule>("/ops/schedules", body);
}

export async function testFireSchedule(id: string) {
  return apiPost<{ fired: boolean; outcome: string }>(`/ops/schedules/${encodeURIComponent(id)}/test-fire`, {});
}

export async function pauseSchedule(id: string, paused = true) {
  return apiPost<Schedule>(`/ops/schedules/${encodeURIComponent(id)}/pause`, { paused });
}

export async function fetchAutonomyMatrix() {
  return apiGet<AutonomyMatrix>("/ops/autonomy");
}

export async function updateAutonomyPolicy(body: {
  projectId?: string;
  default?: string;
  envs?: Record<string, string>;
}) {
  return apiPut<AutonomyMatrix>("/ops/autonomy", body);
}

export async function evaluateAutonomyTool(toolName: string, projectEnv = "production") {
  return apiPost<{ allowed: boolean; action: string; level: string; reasons: string[] }>(
    "/ops/autonomy/evaluate-tool",
    { toolName, projectEnv }
  );
}

export interface ReleaseAnalysis {
  repo: string;
  prCount: number;
  changelog: string;
  semver: { bump: string; suggested: string; reason: string };
  migrationRisks: Array<{ prNumber: number; level: string; kind: string }>;
  testChecklist: string[];
  rollbackNote: string;
}

export interface MaintenanceScan {
  outdatedCount: number;
  safeUpdates: Array<{ name: string; riskScore: number }>;
  highRisk: Array<{ name: string; riskScore: number; requiresApproval: boolean }>;
  requiresApproval: boolean;
}

export interface HygieneScan {
  summary: { stalePrCount: number; todoCount: number; failedRunArchiveCount: number };
  reportMarkdown: string;
  requiresApproval: boolean;
}

export async function fetchAgentPresets() {
  return apiGet<{ runbookIds: string[]; templateIds: string[]; schedules: Array<{ id: string; name: string; description: string }> }>(
    "/agents/presets"
  );
}

export async function analyzeRelease(repo: string, sinceTag = "v0.0.0", prs?: unknown[]) {
  return apiPost<ReleaseAnalysis>("/agents/release/analyze", { repo, sinceTag, prs });
}

export async function scanMaintenance(workspacePath = ".") {
  return apiPost<MaintenanceScan>("/agents/maintenance/scan", { workspacePath });
}

export async function scanHygiene(repo: string, stalePrDays = 30) {
  return apiPost<HygieneScan>("/agents/hygiene/scan", { repo, stalePrDays, branches: ["feature/old", "fix/stale"] });
}

export async function createScheduleFromPreset(presetId: string) {
  return apiPost<Schedule>(`/agents/schedules/from-preset/${encodeURIComponent(presetId)}`, {});
}

export interface Briefing {
  id: string;
  type: string;
  title: string;
  markdown: string;
  read: boolean;
  archived: boolean;
  createdAt: string;
}

export async function fetchBriefings() {
  return apiGet<{ briefings: Briefing[]; count: number }>("/reports/briefings");
}

export async function generateBriefing(type = "daily_engineering") {
  return apiPost<Briefing>("/reports/generate", { type });
}

export async function deliverBriefing(id: string, channel = "native") {
  return apiPost<{ delivered: boolean }>(`/reports/briefings/${encodeURIComponent(id)}/deliver`, { channel });
}

export async function fetchSlaViolations() {
  return apiGet<{ violations: Array<{ id: string; rule: string; message: string; at?: string }>; count: number }>(
    "/sla/violations"
  );
}

export interface SlaDashboard {
  projectId: string | null;
  totalViolations: number;
  violationsLast7d: number;
  byRule: Record<string, number>;
  recent: Array<{ id: string; rule: string; message: string; at: string }>;
  mttrMinutesEstimate: number | null;
  generatedAt: string;
}

export async function fetchSlaDashboard() {
  return apiGet<SlaDashboard>("/sla/dashboard");
}

export async function evaluateSla() {
  return apiPost<{ evaluatedAt: string }>("/sla/evaluate", {});
}

export async function fetchEnvRegistry() {
  return apiGet<{ projectId: string; environments: Record<string, { name: string; autonomyLevel: string }> }>(
    "/env/registry"
  );
}

export async function createPromotion(fromEnv: string, toEnv: string, changeSummary = "") {
  return apiPost<{ id: string; status: string; approvalChain: string[] }>("/env/promotions", {
    fromEnv,
    toEnv,
    changeSummary,
  });
}

export interface PromotionRequest {
  id: string;
  projectId: string;
  fromEnv: string;
  toEnv: string;
  status: string;
  changeSummary?: string;
  approvalChain: string[];
  approvals: Array<{ role: string; status: string; at?: string | null }>;
  deploymentResult?: { configMerged?: boolean; pipeline?: Array<{ step: string; status: string; note?: string }> };
}

export async function fetchPromotions(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiGet<{ requests: PromotionRequest[]; count: number }>(`/env/promotions${q}`);
}

export async function approvePromotion(id: string, role: string, decision: "approve" | "reject" = "approve") {
  return apiPost<PromotionRequest>(`/env/promotions/${encodeURIComponent(id)}/approve`, { role, decision });
}

export async function executePromotion(id: string) {
  return apiPost<PromotionRequest>(`/env/promotions/${encodeURIComponent(id)}/execute`, {});
}

export function briefingExportUrl(id: string, format: "md" | "html" | "pdf") {
  return `/reports/briefings/${encodeURIComponent(id)}/export.${format}`;
}

export async function triageIncident(repo: string) {
  return apiPost<{
    timeline: Array<{ at: string; type: string; message: string }>;
    suspectedCauses: Array<{ rank: number; detail: string; confidence: number }>;
    postmortemDraft: string;
  }>("/agents/incident/triage", { repo });
}

export async function diffEnvConfigs(fromEnv: string, toEnv: string, projectId?: string) {
  return apiPost<{ diffs: Array<{ key: string; change: string }>; masked: boolean }>("/env/diff", {
    fromEnv,
    toEnv,
    projectId,
  });
}
