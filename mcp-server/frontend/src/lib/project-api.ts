import { apiGet, apiPut, apiPost, apiDelete } from "./api-client";

export interface ProjectLinks {
  githubRepo?: string | null;
  backendRepo?: string | null;
  frontendRepo?: string | null;
  mobileRepo?: string | null;
  websiteUrl?: string | null;
  backendUrl?: string | null;
  frontendUrl?: string | null;
  mobileUrl?: string | null;
  notionProjectId?: string | null;
  obsidianVaultPath?: string | null;
  defaultBranch?: string;
}

export interface ProjectContextNode {
  id: string;
  type: string;
  label: string;
}

export interface ProjectContext {
  project: { key: string; name: string; envs?: string[] };
  links: ProjectLinks | null;
  recentEvents: Array<{
    id: string;
    eventType: string;
    summary?: string | null;
    occurredAt: string;
  }>;
  recentRuns: Array<{
    id: string;
    goal?: string | null;
    status: string;
    stepCount?: number;
    startedAt?: string | null;
    finishedAt?: string | null;
  }>;
  graph: { nodes: ProjectContextNode[]; edges?: Array<{ from: string; to: string; type: string }> };
  lastChangeSummary?: string;
}

export interface ProjectSummary {
  key: string;
  name: string;
  envs?: string[];
  createdAt?: string;
}

export interface ProjectRecord {
  name: string;
  envs?: Record<string, Record<string, string>>;
  links?: ProjectLinks;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchProjectsList() {
  return apiGet<{ projects: ProjectSummary[]; count: number }>("/projects");
}

export async function fetchProjectDetail(projectKey: string) {
  return apiGet<{ key: string; project: ProjectRecord }>(`/projects/${encodeURIComponent(projectKey)}`);
}

export async function createProject(key: string, name: string) {
  return apiPost<{ project: { key: string; name: string } }>("/projects", { key, name });
}

export async function deleteProject(projectKey: string) {
  return apiDelete<{ deleted: string }>(`/projects/${encodeURIComponent(projectKey)}`);
}

export async function askProject(projectKey: string, q: string, limit = 8) {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return apiGet<{ projectId: string; goal: string; snippets: unknown[] }>(
    `/projects/${encodeURIComponent(projectKey)}/ask?${params}`
  );
}

export async function fetchProjectImpact(projectKey: string, path: string) {
  const params = new URLSearchParams({ path });
  return apiGet<{ projectId: string; path: string; events: unknown[]; edges: unknown[] }>(
    `/projects/${encodeURIComponent(projectKey)}/impact?${params}`
  );
}

export async function fetchProjectContext(projectKey: string) {
  return apiGet<ProjectContext>(`/projects/${encodeURIComponent(projectKey)}/context`);
}

export async function fetchProjectChanges(projectKey: string, sinceDays = 14) {
  return apiGet<{ projectId: string; events: unknown[]; runs: unknown[]; summary: Record<string, number> }>(
    `/projects/${encodeURIComponent(projectKey)}/changes?sinceDays=${sinceDays}`
  );
}

export async function updateProjectLinks(projectKey: string, links: Partial<ProjectLinks>) {
  return apiPut<{ project: string; links: ProjectLinks }>(
    `/projects/${encodeURIComponent(projectKey)}/links`,
    links
  );
}

export async function syncProjectIndex(projectKey: string, sinceDays = 14, async = true) {
  return apiPost<{ async?: boolean; jobId?: string; synced?: number }>(
    `/projects/${encodeURIComponent(projectKey)}/sync`,
    { sinceDays, async }
  );
}
