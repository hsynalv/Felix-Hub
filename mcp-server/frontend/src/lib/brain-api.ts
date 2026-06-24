import { apiGet, apiPost, apiGetRaw } from "./api-client";
import { getApiKey } from "./auth";

function authHeaders(extra: HeadersInit = {}): HeadersInit {
  const key = getApiKey();
  return {
    Accept: "application/json",
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
    ...extra,
  };
}

export type MemoryType = "fact" | "decision" | "preference" | "event" | "project_note";

export interface BrainMemory {
  id: string;
  content: string;
  type: MemoryType;
  tags?: string[];
  projectId?: string | null;
  importance?: number;
  confidence?: number;
  source?: string;
  createdAt: string;
  updatedAt?: string;
  score?: number;
}

export interface BrainProject {
  slug?: string;
  name: string;
  status?: string;
  description?: string;
  stack?: string;
  path?: string;
}

export interface BrainStats {
  total: number;
  byType?: Record<string, number>;
  byProject?: Record<string, number>;
}

export async function fetchBrainStats() {
  const res = await apiGetRaw<{ data?: { memories?: BrainStats } }>("/brain/stats");
  return res.data?.memories ?? (res as { memories?: BrainStats }).memories;
}

export async function fetchBrainProfile() {
  return apiGet<Record<string, string>>("/brain/profile");
}

export async function fetchMemories(params: {
  type?: string;
  projectId?: string;
  tags?: string;
  limit?: number;
  offset?: number;
}) {
  const q = new URLSearchParams();
  if (params.type) q.set("type", params.type);
  if (params.projectId) q.set("projectId", params.projectId);
  if (params.tags) q.set("tags", params.tags);
  q.set("limit", String(params.limit ?? 50));
  q.set("offset", String(params.offset ?? 0));
  return apiGet<{ total: number; memories: BrainMemory[] }>(`/brain/memories?${q}`);
}

export async function fetchMemory(id: string) {
  return apiGet<BrainMemory>(`/brain/memories/${id}`);
}

export async function createMemory(body: {
  content: string;
  type?: MemoryType;
  tags?: string[];
  projectId?: string | null;
  importance?: number;
}) {
  return apiPost<BrainMemory>("/brain/memories", body);
}

export async function updateMemory(
  id: string,
  body: Partial<{
    content: string;
    type: MemoryType;
    tags: string[];
    projectId: string | null;
    importance: number;
  }>
) {
  const res = await fetch(`/brain/memories/${id}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || res.statusText);
  return (json.data ?? json) as BrainMemory;
}

export async function deleteMemory(id: string) {
  const res = await fetch(`/brain/memories/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || res.statusText);
  return json;
}

export async function recallMemories(body: {
  query: string;
  type?: MemoryType;
  projectId?: string;
  tags?: string[];
  limit?: number;
}) {
  return apiPost<{
    query: string;
    total: number;
    memories: BrainMemory[];
  }>("/brain/recall", body);
}

export async function fetchProjects() {
  return apiGet<{ total: number; projects: BrainProject[] }>("/brain/projects");
}

export async function fetchObsidianStatus() {
  return apiGet<{ enabled: boolean; vaultPath: string | null }>("/brain/obsidian/status");
}

export async function syncObsidian() {
  return apiPost<{ synced: number; errors: number; total: number }>("/brain/obsidian/sync");
}

export async function pullObsidian() {
  return apiPost<{ updated: number; skipped: number; errors: number }>("/brain/obsidian/pull");
}

export async function fetchObsidianCanvas() {
  return apiGet<{ nodes: unknown[]; edges: unknown[] }>("/brain/obsidian/canvas");
}

export async function downloadObsidianCanvas() {
  const key = getApiKey();
  const res = await fetch("/brain/obsidian/canvas?download=1", {
    headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mcp-hub-brain.canvas";
  a.click();
  URL.revokeObjectURL(url);
}
