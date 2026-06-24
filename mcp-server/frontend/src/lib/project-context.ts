import { apiGet, apiPut } from "./api-client";
import { setWorkspaceContext } from "./workspace-context-store";

export interface WorkspacePreferences {
  projectId: string;
  projectEnv: string;
  persisted: boolean;
  storage: "database" | "memory" | "default";
  updatedAt: string | null;
  actorId?: string;
}

const LEGACY_PROJECT_ID_KEY = "mcp-hub-project-id";
const LEGACY_PROJECT_ENV_KEY = "mcp-hub-project-env";

let hydrated = false;

function readLegacyLocalStorage() {
  if (typeof localStorage === "undefined") return null;
  const id = localStorage.getItem(LEGACY_PROJECT_ID_KEY);
  const env = localStorage.getItem(LEGACY_PROJECT_ENV_KEY);
  if (!id && !env) return null;
  return {
    projectId: id || "default",
    projectEnv: env || "development",
  };
}

function clearLegacyLocalStorage() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(LEGACY_PROJECT_ID_KEY);
  localStorage.removeItem(LEGACY_PROJECT_ENV_KEY);
}

export async function fetchWorkspacePreferences() {
  return apiGet<WorkspacePreferences>("/workspace/preferences");
}

export async function saveWorkspacePreferences(body: {
  projectId: string;
  projectEnv: string;
}) {
  return apiPut<WorkspacePreferences>("/workspace/preferences", body);
}

export async function hydrateProjectContext() {
  const legacy = readLegacyLocalStorage();
  const server = await fetchWorkspacePreferences();

  if (legacy && !server.persisted) {
    const migrated = await saveWorkspacePreferences(legacy);
    setWorkspaceContext(migrated);
    clearLegacyLocalStorage();
    hydrated = true;
    return migrated;
  }

  setWorkspaceContext(server);
  hydrated = true;
  return server;
}

export function isProjectContextHydrated() {
  return hydrated;
}

export async function saveProjectContext(body: { projectId: string; projectEnv: string }) {
  const data = await saveWorkspacePreferences(body);
  setWorkspaceContext(data);
  return data;
}

export { getProjectId, getProjectEnv, subscribeWorkspaceContext } from "./workspace-context-store";
