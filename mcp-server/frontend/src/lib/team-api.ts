import { apiGet, apiPost, apiDelete } from "./api-client";

export interface IntegrationPack {
  id: string;
  name: string;
  description: string;
  icon: string;
  pluginCount: number;
  toolCount: number;
}

export interface PackPluginStatus {
  name: string;
  installed: boolean;
  enabled: boolean;
  envComplete: boolean;
  missingEnv?: string[];
}

export interface TeamMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  addedBy?: string;
  createdAt: string;
}

export async function fetchIntegrationPacks() {
  return apiGet<{ packs: IntegrationPack[] }>("/team/packs");
}

export async function fetchPackDetail(packId: string) {
  return apiGet<{
    pack: IntegrationPack & { plugins: string[]; tools: string[] };
    pluginStatus: PackPluginStatus[];
  }>(`/team/packs/${encodeURIComponent(packId)}`);
}

export async function installIntegrationPack(packId: string) {
  return apiPost<{ packId: string; enabled: number; total: number; results: unknown[] }>(
    `/team/packs/${encodeURIComponent(packId)}/install`,
    {}
  );
}

export async function fetchProjectMembers(projectId: string) {
  return apiGet<{ members: TeamMember[]; count: number }>(
    `/team/projects/${encodeURIComponent(projectId)}/members`
  );
}

export async function addProjectMember(projectId: string, userId: string, role = "member") {
  return apiPost<TeamMember>(`/team/projects/${encodeURIComponent(projectId)}/members`, { userId, role });
}

export async function removeProjectMember(projectId: string, userId: string) {
  return apiDelete<{ removed: string }>(
    `/team/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`
  );
}
