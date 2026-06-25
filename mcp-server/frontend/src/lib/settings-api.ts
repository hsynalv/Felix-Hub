import { apiDelete, apiGet, apiPost, apiPut } from "./api-client";

export interface SettingEntry {
  keyName: string;
  namespace: string;
  maskedValue: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SettingsMeta {
  settings: SettingEntry[];
  masterKeyConfigured: boolean;
  persistenceHealthy: boolean;
  hotReloadKeys: string[];
  restartRequiredKeys: string[];
}

export interface ConnectionProfile {
  id: string;
  profileName: string;
  profileType: string;
  config: Record<string, unknown>;
  isDefault: boolean;
  isActive: boolean;
}

export async function fetchSettings() {
  return apiGet<SettingsMeta>("/settings");
}

export interface SettingsAuditEntry {
  id: string;
  actorId?: string | null;
  action: string;
  keyName: string;
  pluginName?: string | null;
  createdAt: string;
}

export async function fetchSettingsAudit(limit = 50) {
  return apiGet<{ entries: SettingsAuditEntry[]; count: number }>(`/settings/audit?limit=${limit}`);
}

export async function upsertSetting(key: string, value: string) {
  return apiPut<{
    keyName: string;
    maskedValue: string;
    requiresRestart?: boolean;
    reload?: { reloaded: string[]; skipped: unknown[] };
  }>(`/settings/${encodeURIComponent(key)}`, { value });
}

export async function deleteSetting(key: string) {
  return apiDelete<{ deleted: string }>(`/settings/${encodeURIComponent(key)}`);
}

export async function fetchConnectionProfiles() {
  return apiGet<{ profiles: ConnectionProfile[] }>("/settings/connections");
}

export async function saveConnectionProfile(body: {
  profileName: string;
  profileType: string;
  config?: Record<string, unknown>;
  isDefault?: boolean;
}) {
  return apiPost<ConnectionProfile>("/settings/connections", body);
}

export async function reloadSettings() {
  return apiPost<{ reloaded: string[]; skipped: unknown[]; errors: unknown[] }>("/settings/reload");
}

export async function fetchEffectiveConfig() {
  return apiGet<Record<string, unknown>>("/settings/effective");
}

export async function fetchSettingsDiff() {
  return apiGet<{
    overlayOnly: Array<{ key: string; masked: string | null }>;
    envOnly: Array<{ key: string; masked: string | null }>;
    conflicts: Array<{ key: string; masked: string | null; note?: string }>;
  }>("/settings/diff");
}

export async function validateSettingsKeys(keys: string[]) {
  return apiPost<Record<string, { ok: boolean | null; error?: string; skipped?: boolean }>>(
    "/settings/validate",
    { keys }
  );
}

export async function fetchSettingsTemplates() {
  return apiGet<{
    templates: Array<{ id: string; label: string; settingsCount?: number; profilesCount?: number }>;
  }>("/settings/templates");
}

export async function applySettingsTemplate(id: string) {
  return apiPost<{ templateId: string; applied: { settings: string[]; profiles: string[] } }>(
    `/settings/apply-template/${encodeURIComponent(id)}`
  );
}

export async function exportSettingsBundle() {
  return apiPost<{ encrypted: string; meta: { settings: number; profiles: number } }>("/settings/export");
}

export async function importSettingsBundle(encrypted: string, dryRun = false) {
  return apiPost<{ importedSettings: number; importedProfiles: number; dryRun?: boolean }>(
    `/settings/import${dryRun ? "?dryRun=1" : ""}`,
    { encrypted, dryRun }
  );
}

export async function rotateMasterKey(newMasterKeyBase64: string, dryRun = false) {
  return apiPost<{
    rotated: number;
    failures: Array<{ keyName: string; error: string }>;
    applied: boolean;
    dryRun: boolean;
  }>("/settings/rotate-master-key", { newMasterKeyBase64, dryRun });
}

export interface EnvCatalogVar {
  name: string;
  required: boolean;
  description: string;
  maskedValue: string | null;
  source: "overlay" | "env" | "unset";
  configured: boolean;
}

export interface EnvCatalogGroup {
  plugin: string;
  label: string;
  description: string;
  version: string | null;
  tools: string[];
  toolCount: number;
  vars: EnvCatalogVar[];
}

export interface EnvCatalogEntry {
  plugin: string;
  vars: Array<{ name: string; required: boolean; description: string }>;
}

export interface EnvCatalogResponse {
  catalog: EnvCatalogEntry[];
  groups: EnvCatalogGroup[];
  unassigned: EnvCatalogVar[];
}

export async function fetchEnvCatalog() {
  return apiGet<EnvCatalogResponse>("/settings/env-catalog");
}

export {
  getProjectId,
  getProjectEnv,
  saveProjectContext,
  hydrateProjectContext,
  fetchWorkspacePreferences,
} from "./project-context";

export interface LlmConfigSnapshot {
  mode: "unified" | "split";
  unified: { configured: boolean; maskedKey: string | null; model: string };
  chat: {
    provider: string;
    resolvedProvider: string;
    model: string;
    configured: boolean;
  };
  router: { provider: string; model: string; configured: boolean };
  providers: Array<{ id: string; keyConfigured: boolean; maskedKey: string | null }>;
  chatProviders: string[];
  routerProviders: string[];
}

export async function fetchLlmConfig() {
  return apiGet<LlmConfigSnapshot>("/settings/llm-config");
}

export async function saveLlmConfig(body: {
  mode?: "unified" | "split";
  unifiedApiKey?: string;
  unifiedModel?: string;
  chatProvider?: string;
  chatModel?: string;
  routerProvider?: string;
  routerModel?: string;
  providerKeys?: {
    openai?: string;
    anthropic?: string;
    google?: string;
    mistral?: string;
    vllmKey?: string;
    vllmUrl?: string;
  };
}) {
  return apiPost<{
    changed: string[];
    reload: { reloaded: string[]; skipped: unknown[]; errors: unknown[] };
    snapshot: LlmConfigSnapshot;
  }>("/settings/llm-config", body);
}
