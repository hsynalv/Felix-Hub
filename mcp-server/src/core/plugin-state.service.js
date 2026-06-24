/**
 * Plugin enable/disable state — MSSQL + memory fallback.
 */

import { persistenceQuery, isPersistenceHealthy } from "./persistence/index.js";

/** @type {Map<string, object>} */
const memoryState = new Map();

const DEFAULT_STATE = {
  enabled: true,
  enabledAt: null,
  enabledBy: null,
  lastHealth: null,
  lastVerifiedAt: null,
  envComplete: true,
};

function rowToState(row) {
  return {
    pluginName: row.plugin_name,
    enabled: row.enabled !== false,
    enabledAt: row.enabled_at,
    enabledBy: row.enabled_by,
    lastHealth: row.last_health,
    lastVerifiedAt: row.last_verified_at,
    envComplete: row.env_complete !== false,
  };
}

function memKey(name) {
  return name;
}

export async function getPluginState(pluginName) {
  if (!pluginName) return { ...DEFAULT_STATE, pluginName };

  if (!isPersistenceHealthy()) {
    return { ...DEFAULT_STATE, ...(memoryState.get(memKey(pluginName)) || {}), pluginName };
  }

  try {
    const result = await persistenceQuery(
      `SELECT * FROM plugin_state WHERE plugin_name = @pluginName`,
      { pluginName }
    );
    const row = result.recordset?.[0];
    if (!row) return { ...DEFAULT_STATE, pluginName };
    return rowToState(row);
  } catch {
    return { ...DEFAULT_STATE, ...(memoryState.get(memKey(pluginName)) || {}), pluginName };
  }
}

export async function isPluginEnabled(pluginName) {
  const state = await getPluginState(pluginName);
  return state.enabled !== false;
}

export async function listPluginStates() {
  if (!isPersistenceHealthy()) {
    return [...memoryState.values()];
  }
  try {
    const result = await persistenceQuery(`SELECT * FROM plugin_state ORDER BY plugin_name`);
    return (result.recordset || []).map(rowToState);
  } catch {
    return [...memoryState.values()];
  }
}

export async function upsertPluginState(pluginName, patch = {}) {
  const prev = await getPluginState(pluginName);
  const next = {
    ...prev,
    ...patch,
    pluginName,
  };

  if (!isPersistenceHealthy()) {
    memoryState.set(memKey(pluginName), next);
    return next;
  }

  await persistenceQuery(
    `MERGE plugin_state AS t
     USING (SELECT @pluginName AS plugin_name) AS s
     ON t.plugin_name = s.plugin_name
     WHEN MATCHED THEN
       UPDATE SET
         enabled = @enabled,
         enabled_at = @enabledAt,
         enabled_by = @enabledBy,
         last_health = @lastHealth,
         last_verified_at = @lastVerifiedAt,
         env_complete = @envComplete,
         updated_at = SYSUTCDATETIME()
     WHEN NOT MATCHED THEN
       INSERT (plugin_name, enabled, enabled_at, enabled_by, last_health, last_verified_at, env_complete)
       VALUES (@pluginName, @enabled, @enabledAt, @enabledBy, @lastHealth, @lastVerifiedAt, @envComplete);`,
    {
      pluginName,
      enabled: next.enabled !== false ? 1 : 0,
      enabledAt: next.enabledAt ? new Date(next.enabledAt) : null,
      enabledBy: next.enabledBy || null,
      lastHealth: next.lastHealth || null,
      lastVerifiedAt: next.lastVerifiedAt ? new Date(next.lastVerifiedAt) : null,
      envComplete: next.envComplete !== false ? 1 : 0,
    }
  );

  return next;
}

export async function setPluginEnabled(pluginName, enabled, { actor = "api", envComplete = true } = {}) {
  return upsertPluginState(pluginName, {
    enabled,
    enabledAt: enabled ? new Date().toISOString() : null,
    enabledBy: enabled ? actor : null,
    envComplete,
  });
}

export async function recordPluginHealth(pluginName, { ok, envComplete = null } = {}) {
  const patch = {
    lastHealth: ok ? "ok" : "fail",
    lastVerifiedAt: new Date().toISOString(),
  };
  if (envComplete != null) patch.envComplete = envComplete;
  return upsertPluginState(pluginName, patch);
}

export function resetPluginStateForTests() {
  memoryState.clear();
}
