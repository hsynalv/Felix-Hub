import { apiGet, apiPut, apiPost } from "./api-client";

export interface ProjectLinks {
  githubRepo?: string | null;
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
  graph: { nodes: ProjectContextNode[] };
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
