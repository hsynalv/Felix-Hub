import { apiGet, apiPost, apiPut } from "./api-client";
import type { InboxItem, InboxSummary } from "./inbox-api";

export interface PersonalBriefing {
  date: string;
  scope: string;
  summary: string;
  bullets: string[];
  stats: {
    unreadInbox: number;
    pendingApprovals: number;
    activeRuns: number;
    failedRunsToday: number;
    projects: number;
  };
  sources: Record<string, { status: string; hint?: string }>;
  generatedAt: string;
}

export interface SuggestedAction {
  id: string;
  priority: "critical" | "high" | "normal" | "low";
  title: string;
  message: string;
  href: string;
  kind: string;
}

export async function fetchPersonalBriefingLatest() {
  return apiGet<{ briefing: DailyBriefingRecord | null }>("/personal/briefing/latest");
}

export async function generatePersonalBriefing() {
  return apiPost<DailyBriefingRecord>("/personal/briefing/generate", {});
}

export async function rememberPersonalMemory(key: string, value: string, pinned = false) {
  return apiPost<{ id: string; key: string; value: string }>("/personal/memory/remember", {
    key,
    value,
    pinned,
  });
}

export interface DailyBriefingItem {
  id: string;
  source: string;
  title: string;
  body: string;
  importance: number;
  actionRequired: boolean;
  href: string;
  createdAt: string;
}

export interface DailyBriefingRecord {
  id: string;
  date: string;
  summary: string;
  items: DailyBriefingItem[];
  generatedAt: string;
}

export interface PersonalCommandCenter {
  scope: string;
  projectId: string | null;
  generatedAt: string;
  today: PersonalBriefing;
  inbox: { summary: InboxSummary; items: InboxItem[] };
  approvals: Array<{
    id: string;
    toolName?: string;
    explanation?: string;
    riskScore?: number;
    runId?: string;
    createdAt?: string;
  }>;
  activeRuns: Array<{
    id: string;
    goal?: string;
    status: string;
    projectId?: string;
    startedAt?: string;
    updatedAt?: string;
  }>;
  projects: Array<{ key: string; name: string; envCount: number }>;
  usage: { days: number; totalCostUsd: number; totalTokens: number; eventCount: number } | null;
  memory: { preferences: Array<{ id: string; key: string; value: string; pinned: boolean; scope: string }> };
  mail: {
    status: string;
    items: Array<{ id: string; title: string; body?: string; createdAt?: string }>;
    hint?: string;
  };
  news: {
    status: string;
    items: Array<{ id: string; title: string; source?: string; sourceLabel?: string; createdAt?: string }>;
    hint?: string;
  };
  telegram: { status: string; hint?: string };
  desktop?: {
    mode: string;
    sidecar: { paired: boolean; required: boolean };
    allowlist: { apps: string[]; domains: string[] };
  };
  autonomy?: {
    presetId: string;
    label: string;
    level: string;
    desktopMode: string;
    presets: Array<{ id: string; label: string }>;
  };
  ops?: {
    emergencyStop: boolean;
    hubPaused: boolean;
    maxDailySpendUsd: number;
    desktopActionsToday: number;
  };
  jarvis?: {
    mode: { id: string; label: string };
    currentActivity: { status: string; message: string };
    quickActions: Array<{ id: string; label: string; href: string }>;
  };
  lifeAgents?: Array<{ id: string; name: string; enabled: boolean }>;
  suggestedActions: SuggestedAction[];
  dailyBriefing: DailyBriefingRecord | null;
}

export async function fetchPersonalCommandCenter(params?: {
  scope?: "personal" | "project";
  projectKey?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.scope) qs.set("scope", params.scope);
  if (params?.projectKey) qs.set("projectKey", params.projectKey);
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiGet<PersonalCommandCenter>(`/personal/command-center${suffix}`);
}

export async function fetchPersonalBriefingToday() {
  return apiGet<PersonalBriefing>("/personal/briefing/today");
}

export async function setPersonalAutonomyPreset(presetId: string) {
  return apiPost<unknown>("/personal/autonomy/preset", { presetId });
}

export async function triggerPersonalEmergencyStop(minutes = 60) {
  return apiPost<unknown>("/personal/ops/emergency-stop", { minutes });
}

export async function clearPersonalEmergencyStop() {
  return apiPost<unknown>("/personal/ops/emergency-resume", {});
}

export interface LifeAgentPreset {
  id: string;
  name: string;
  goal: string;
  type: string;
  approvalPolicy: string;
  costLimitUsd: number;
}

export interface LifeAgent {
  id: string;
  name: string;
  goal: string;
  type: string;
  presetId: string | null;
  enabled: boolean;
  approvalPolicy: string;
  costLimitUsd: number;
  lastRunAt: string | null;
}

export interface JarvisMode {
  id: string;
  label: string;
  description: string;
}

export async function fetchLifeAgentPresets() {
  return apiGet<{ presets: LifeAgentPreset[] }>("/personal/life-agents/presets");
}

export async function fetchLifeAgents() {
  return apiGet<{ agents: LifeAgent[] }>("/personal/life-agents");
}

export async function createLifeAgentFromPreset(presetId: string, name?: string) {
  return apiPost<LifeAgent>("/personal/life-agents", { presetId, name });
}

export async function testLifeAgent(id: string) {
  return apiPost<{ agentId: string; runId: string; dryRun: boolean }>(`/personal/life-agents/${id}/test`, {});
}

export async function searchShopping(query: string) {
  return apiPost<{
    sessionId: string;
    query: string;
    results: Array<{ id: string; title: string; price: string | null; snippet: string }>;
    summary: string;
  }>("/personal/shopping/search", { query });
}

export async function fetchJarvisState() {
  return apiGet<{ mode: JarvisMode & { modeId: string }; modes: JarvisMode[]; quickActions: Array<{ id: string; label: string; href: string }> }>(
    "/personal/jarvis"
  );
}

export async function setJarvisMode(modeId: string) {
  return apiPut<{ mode: JarvisMode & { modeId: string } }>("/personal/jarvis/mode", { modeId });
}

export async function fetchJarvisLive() {
  return apiGet<{
    mode: JarvisMode & { modeId: string };
    currentActivity: { status: string; message: string };
    pendingApprovals: number;
  }>("/personal/jarvis/live");
}

export async function fetchJarvisOverlay() {
  return apiGet<{
    mode: string;
    modeId: string;
    status: string;
    message: string;
    pendingApprovals: number;
    activeRunCount: number;
    hubPaused: boolean;
    emergencyStop: boolean;
    updatedAt: string;
  }>("/personal/jarvis/overlay");
}

export async function submitBriefingFeedback(itemId: string, feedback: string, briefingId?: string) {
  return apiPost<{ id: string }>("/personal/briefing/feedback", { itemId, feedback, briefingId });
}

export async function explainPersonalMemory(id: string) {
  return apiGet<{
    id: string;
    key: string;
    value: string;
    explanation: string;
    source: string;
    editable: boolean;
  }>(`/personal/memory/${id}/explain`);
}

export async function updatePersonalMemoryEntry(id: string, key: string, value: string) {
  return apiPut<{ id: string; key: string; value: string }>(`/personal/memory/${id}`, { key, value });
}
