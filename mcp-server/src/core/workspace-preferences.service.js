/**
 * Per-actor workspace preferences (active project + environment).
 */

import { createHash } from "crypto";
import {
  persistenceQuery,
  isPersistenceHealthy,
} from "./persistence/index.js";
import { isAuthEnabled, extractAuthKey } from "./auth.js";

const DEFAULT_PROJECT_ID = "default";
const DEFAULT_PROJECT_ENV = "development";
const VALID_ENVS = new Set(["development", "staging", "production"]);

/** @type {Map<string, { projectId: string, projectEnv: string, updatedAt: string }>} */
const memoryStore = new Map();

export function resolveActorId(req) {
  if (req?.user?.userId) return String(req.user.userId);
  if (!isAuthEnabled()) return "open";
  const key = extractAuthKey(req);
  if (!key) return "anonymous";
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

function normalizeProjectId(value) {
  const id = String(value || "").trim();
  if (!id) return DEFAULT_PROJECT_ID;
  return id.slice(0, 128);
}

function normalizeProjectEnv(value) {
  const env = String(value || "").trim().toLowerCase();
  if (!VALID_ENVS.has(env)) return DEFAULT_PROJECT_ENV;
  return env;
}

function defaultPayload(persisted = false) {
  return {
    projectId: DEFAULT_PROJECT_ID,
    projectEnv: DEFAULT_PROJECT_ENV,
    persisted,
    storage: persisted ? "database" : "default",
    updatedAt: null,
  };
}

export async function getWorkspacePreferences(actorId) {
  if (isPersistenceHealthy()) {
    try {
      const result = await persistenceQuery(
        `SELECT TOP 1 project_id, project_env, updated_at FROM workspace_preferences WHERE actor_id = @actorId`,
        { actorId }
      );
      const row = result?.recordset?.[0];
      if (row) {
        return {
          projectId: row.project_id,
          projectEnv: row.project_env,
          persisted: true,
          storage: "database",
          updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at ?? null,
        };
      }
    } catch (err) {
      console.warn("[workspace-preferences] read failed:", err.message);
    }
  }

  const mem = memoryStore.get(actorId);
  if (mem) {
    return {
      projectId: mem.projectId,
      projectEnv: mem.projectEnv,
      persisted: true,
      storage: "memory",
      updatedAt: mem.updatedAt,
    };
  }

  return defaultPayload(false);
}

export async function setWorkspacePreferences(actorId, { projectId, projectEnv }) {
  const normalized = {
    projectId: normalizeProjectId(projectId),
    projectEnv: normalizeProjectEnv(projectEnv),
  };
  const updatedAt = new Date().toISOString();

  if (isPersistenceHealthy()) {
    await persistenceQuery(
      `
      MERGE workspace_preferences AS target
      USING (SELECT @actorId AS actor_id) AS source
      ON target.actor_id = source.actor_id
      WHEN MATCHED THEN
        UPDATE SET project_id = @projectId, project_env = @projectEnv, updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (actor_id, project_id, project_env)
        VALUES (@actorId, @projectId, @projectEnv);
      `,
      {
        actorId,
        projectId: normalized.projectId,
        projectEnv: normalized.projectEnv,
      }
    );
    return {
      ...normalized,
      persisted: true,
      storage: "database",
      updatedAt,
    };
  }

  memoryStore.set(actorId, { ...normalized, updatedAt });
  return {
    ...normalized,
    persisted: true,
    storage: "memory",
    updatedAt,
  };
}

export function resetWorkspacePreferencesForTests() {
  memoryStore.clear();
}
