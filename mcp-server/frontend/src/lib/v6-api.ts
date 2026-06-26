import { apiGet, apiPost, apiPut } from "./api-client";

export interface AgentRole {
  id: string;
  label: string;
  description: string;
  allowedToolPrefixes: string[];
  maxAutonomy: string;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  version: number;
  builtin: boolean;
  templateId: string | null;
  tags: string[];
  parameters: Array<{ name: string; type: string; required?: boolean }>;
  phases: unknown[];
}

export interface Watcher {
  id: string;
  name: string;
  description: string;
  source: string;
  eventTypes: string[];
  skillId: string | null;
  templateId: string | null;
  minTrustScore: number;
  cooldownMinutes: number;
  enabled: boolean;
  lastFiredAt: string | null;
  lastRunId: string | null;
  lastOutcome: string | null;
}

export interface SandboxSession {
  id: string;
  name: string;
  status: string;
  mocks: Record<string, unknown>;
  calls: Array<{ at: string; tool: string; args: unknown; result: unknown }>;
  createdAt: string;
}

export interface TrustScore {
  entityType: string;
  entityId: string;
  score: number;
  confidence: number;
  successRate: number;
  totalRuns: number;
  completed: number;
  failed: number;
}

export async function fetchAgentRoles() {
  const data = await apiGet<{ roles: AgentRole[] }>("/multi-agent/roles");
  return data.roles;
}

export async function fetchSkills() {
  const data = await apiGet<{ skills: AgentSkill[] }>("/skills");
  return data.skills;
}

export async function compileSkill(skillId: string, parameters: Record<string, unknown> = {}) {
  return apiPost<unknown>(`/skills/${skillId}/compile`, { parameters });
}

export async function runSkill(skillId: string, parameters: Record<string, unknown> = {}, dryRun = true) {
  return apiPost<unknown>(`/skills/${skillId}/run`, { parameters, dryRun });
}

export async function fetchWatchers() {
  const data = await apiGet<{ watchers: Watcher[] }>("/watchers");
  return data.watchers;
}

export async function createWatcher(input: Partial<Watcher> & { name: string; skillId?: string; templateId?: string }) {
  return apiPost<Watcher>("/watchers", input);
}

export async function testFireWatcher(watcherId: string) {
  return apiPost<unknown>(`/watchers/${watcherId}/test-fire`, { message: "UI test fire" });
}

export async function fetchSandboxSessions() {
  const data = await apiGet<{ sessions: SandboxSession[] }>("/sandbox/sessions");
  return data.sessions;
}

export async function createSandboxSession(name: string) {
  return apiPost<SandboxSession>("/sandbox/sessions", { name });
}

export async function closeSandboxSession(sessionId: string) {
  return apiPost<SandboxSession>(`/sandbox/sessions/${sessionId}/close`, {});
}

export async function fetchTrustScores() {
  const data = await apiGet<{ scores: TrustScore[] }>("/trust/scores");
  return data.scores;
}

export async function recalculateTrustScores() {
  const data = await apiPost<{ scores: TrustScore[] }>("/trust/recalculate", {});
  return data.scores;
}

export async function spawnChildRun(
  parentId: string,
  input: { role: string; goal?: string; templateId?: string; dryRun?: boolean }
) {
  return apiPost<unknown>(`/multi-agent/parents/${parentId}/spawn`, input);
}

export async function createParentRun(goal: string) {
  return apiPost<{ id: string }>("/multi-agent/parents", { goal });
}

export async function fetchParentAggregate(parentId: string) {
  return apiGet<unknown>(`/multi-agent/parents/${parentId}/aggregate`);
}
