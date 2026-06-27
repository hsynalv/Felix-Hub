import { apiGet, apiPost, apiPut } from "./api-client";

export interface MarketplacePack {
  id: string;
  label: string;
  description: string;
  chatProfile: string;
  chatMode: string;
  tags: string[];
}

export interface SpecArtifact {
  content: string;
  updatedAt?: string;
}

export interface SpecSession {
  id: string;
  title: string;
  idea: string;
  stage: string;
  projectId?: string | null;
  artifacts: Record<string, SpecArtifact>;
  createdAt: string;
  updatedAt: string;
}

export interface ImportDraftSummary {
  id: string;
  name: string;
  description?: string;
  mode: string;
  tags?: string[];
  disabled: boolean;
  risk: string;
  segmentCount?: number;
  sectionKeys: string[];
  provenance?: Record<string, unknown>;
}

export async function fetchMarketplacePacks() {
  return apiGet<{ packs: MarketplacePack[] }>("/v8/prompt-marketplace");
}

export async function createSpecSession(body: { title: string; idea: string; projectId?: string }) {
  return apiPost<SpecSession>("/spec/sessions", body);
}

export async function advanceSpecSession(id: string, content?: string, stage?: string) {
  return apiPost<{
    session: SpecSession;
    savedStage: string;
    nextStage: string;
    workflowDraft?: Record<string, unknown> | null;
  }>(`/spec/sessions/${encodeURIComponent(id)}/advance`, { content, stage });
}

export async function fetchSpecSession(id: string) {
  return apiGet<SpecSession>(`/spec/sessions/${encodeURIComponent(id)}`);
}

export async function updateSpecArtifact(id: string, stage: string, content: string) {
  return apiPut<SpecSession>(`/spec/sessions/${encodeURIComponent(id)}/artifacts/${stage}`, { content });
}

export async function fetchImportDrafts() {
  return apiGet<{ drafts: ImportDraftSummary[]; count: number }>("/v8/prompt-import/drafts");
}

export async function fetchImportDraft(id: string) {
  return apiGet<Record<string, unknown>>(`/v8/prompt-import/drafts/${encodeURIComponent(id)}`);
}

export async function scanPromptArchive(body?: { source?: string; provider?: string; maxFiles?: number }) {
  return apiPost<{ count: number; drafts: Array<{ id: string; risk: string }> }>(
    "/v8/prompt-import/scan",
    body || {}
  );
}

export async function approveImportDraft(id: string, force = false) {
  return apiPost<{ draftId: string; promptId: string; name: string }>(
    `/v8/prompt-import/drafts/${encodeURIComponent(id)}/approve`,
    { force }
  );
}

export async function rejectImportDraft(id: string, reason?: string) {
  return apiPost<{ draftId: string; rejected: boolean }>(
    `/v8/prompt-import/drafts/${encodeURIComponent(id)}/reject`,
    { reason }
  );
}

export function isSpecChatMode(settings: {
  chatMode?: string;
  chatProfile?: string;
  marketplacePackId?: string;
}) {
  return (
    settings.chatMode === "spec" ||
    settings.chatProfile === "spec_planner" ||
    settings.marketplacePackId === "felix-spec-kiro"
  );
}
