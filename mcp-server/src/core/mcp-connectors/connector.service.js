/**
 * External MCP connector persistence and validation.
 */

import { persistenceQuery, isPersistenceHealthy, randomUUID } from "../persistence/index.js";
import { getEnvValue } from "../settings/effective-config.js";

/** @type {Map<string, object>} */
const memoryConnectors = new Map();

export const ALLOWED_COMMANDS = new Set(["node", "npx", "uvx", "python", "python3"]);

const SLUG_RE = /^[a-z][a-z0-9_-]{0,62}$/;

function parseJsonArray(raw, fieldName) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`${fieldName} must be a JSON array`);
    }
    return parsed;
  } catch (e) {
    throw Object.assign(new Error(`Invalid ${fieldName}: ${e.message}`), { code: "invalid_args" });
  }
}

function rowToConnector(row) {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    command: row.command,
    args: parseJsonArray(row.args_json, "args"),
    envKeys: parseJsonArray(row.env_keys_json, "envKeys"),
    enabled: row.enabled === true || row.enabled === 1,
    lastHealth: row.last_health,
    lastVerifiedAt: row.last_verified_at,
    toolCount: Number(row.tool_count ?? 0),
    lastError: row.last_error,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function validateSlug(slug) {
  if (!slug || !SLUG_RE.test(slug)) {
    throw Object.assign(new Error("slug must be lowercase alphanumeric (a-z0-9_-)"), {
      code: "invalid_slug",
    });
  }
}

export function validateCommand(command) {
  const base = String(command || "").trim().split(/\s+/)[0];
  if (!ALLOWED_COMMANDS.has(base)) {
    throw Object.assign(
      new Error(`command must be one of: ${[...ALLOWED_COMMANDS].join(", ")}`),
      { code: "invalid_command" }
    );
  }
  return base;
}

export function validateArgs(args) {
  const list = parseJsonArray(args, "args");
  if (!list.every((a) => typeof a === "string")) {
    throw Object.assign(new Error("args must be an array of strings"), { code: "invalid_args" });
  }
  const joined = list.join(" ");
  if (joined.length > 4000) {
    throw Object.assign(new Error("args too long"), { code: "invalid_args" });
  }
  return list;
}

export function validateEnvKeys(envKeys) {
  const list = parseJsonArray(envKeys, "envKeys");
  if (!list.every((k) => typeof k === "string" && /^[A-Z][A-Z0-9_]*$/.test(k))) {
    throw Object.assign(new Error("envKeys must be UPPER_SNAKE_CASE strings"), {
      code: "invalid_env_keys",
    });
  }
  return list;
}

export async function listConnectors() {
  if (!isPersistenceHealthy()) {
    return [...memoryConnectors.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  }
  try {
    const result = await persistenceQuery(
      `SELECT * FROM mcp_connectors ORDER BY display_name, slug`
    );
    return (result?.recordset ?? []).map(rowToConnector);
  } catch {
    return [...memoryConnectors.values()];
  }
}

export async function getConnector(id) {
  if (!id) return null;
  if (!isPersistenceHealthy()) {
    return memoryConnectors.get(id) ?? null;
  }
  try {
    const result = await persistenceQuery(`SELECT * FROM mcp_connectors WHERE id = @id`, { id });
    const row = result?.recordset?.[0];
    return row ? rowToConnector(row) : null;
  } catch {
    return memoryConnectors.get(id) ?? null;
  }
}

export async function getConnectorBySlug(slug) {
  const connectors = await listConnectors();
  return connectors.find((c) => c.slug === slug) ?? null;
}

async function persistConnector(record) {
  if (!isPersistenceHealthy()) {
    memoryConnectors.set(record.id, record);
    return record;
  }

  await persistenceQuery(
    `MERGE mcp_connectors AS t
     USING (SELECT @id AS id) AS s
     ON t.id = s.id
     WHEN MATCHED THEN
       UPDATE SET
         slug = @slug,
         display_name = @displayName,
         command = @command,
         args_json = @argsJson,
         env_keys_json = @envKeysJson,
         enabled = @enabled,
         last_health = @lastHealth,
         last_verified_at = @lastVerifiedAt,
         tool_count = @toolCount,
         last_error = @lastError,
         updated_at = SYSUTCDATETIME()
     WHEN NOT MATCHED THEN
       INSERT (id, slug, display_name, command, args_json, env_keys_json, enabled,
               last_health, last_verified_at, tool_count, last_error, created_by)
       VALUES (@id, @slug, @displayName, @command, @argsJson, @envKeysJson, @enabled,
               @lastHealth, @lastVerifiedAt, @toolCount, @lastError, @createdBy);`,
    {
      id: record.id,
      slug: record.slug,
      displayName: record.displayName,
      command: record.command,
      argsJson: JSON.stringify(record.args ?? []),
      envKeysJson: JSON.stringify(record.envKeys ?? []),
      enabled: record.enabled ? 1 : 0,
      lastHealth: record.lastHealth,
      lastVerifiedAt: record.lastVerifiedAt ? new Date(record.lastVerifiedAt) : null,
      toolCount: record.toolCount ?? 0,
      lastError: record.lastError,
      createdBy: record.createdBy,
    }
  );

  return record;
}

export async function createConnector(input, { actor = "admin" } = {}) {
  const slug = String(input.slug || "").trim().toLowerCase();
  validateSlug(slug);
  const command = validateCommand(input.command);
  const args = validateArgs(input.args ?? []);
  const envKeys = validateEnvKeys(input.envKeys ?? []);

  if (await getConnectorBySlug(slug)) {
    throw Object.assign(new Error(`Connector slug already exists: ${slug}`), {
      code: "duplicate_slug",
    });
  }

  const record = {
    id: randomUUID(),
    slug,
    displayName: String(input.displayName || slug).trim() || slug,
    command,
    args,
    envKeys,
    enabled: false,
    lastHealth: null,
    lastVerifiedAt: null,
    toolCount: 0,
    lastError: null,
    createdBy: actor,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return persistConnector(record);
}

export async function updateConnector(id, patch) {
  const existing = await getConnector(id);
  if (!existing) return null;

  const next = { ...existing };
  if (patch.displayName != null) next.displayName = String(patch.displayName).trim() || next.slug;
  if (patch.command != null) next.command = validateCommand(patch.command);
  if (patch.args != null) next.args = validateArgs(patch.args);
  if (patch.envKeys != null) next.envKeys = validateEnvKeys(patch.envKeys);
  if (patch.slug != null) {
    const slug = String(patch.slug).trim().toLowerCase();
    validateSlug(slug);
    if (slug !== existing.slug) {
      const dup = await getConnectorBySlug(slug);
      if (dup && dup.id !== id) {
        throw Object.assign(new Error(`Connector slug already exists: ${slug}`), {
          code: "duplicate_slug",
        });
      }
      next.slug = slug;
    }
  }

  next.updatedAt = new Date().toISOString();
  return persistConnector(next);
}

export async function deleteConnector(id) {
  const existing = await getConnector(id);
  if (!existing) return false;

  if (!isPersistenceHealthy()) {
    memoryConnectors.delete(id);
    return true;
  }

  await persistenceQuery(`DELETE FROM mcp_connectors WHERE id = @id`, { id });
  return true;
}

export async function patchConnectorState(id, patch) {
  const existing = await getConnector(id);
  if (!existing) return null;
  return persistConnector({ ...existing, ...patch, updatedAt: new Date().toISOString() });
}

export async function setConnectorEnabled(id, enabled, { actor = "admin" } = {}) {
  return patchConnectorState(id, {
    enabled: !!enabled,
    createdBy: actor,
  });
}

export async function recordConnectorHealth(id, { ok, toolCount = null, error = null } = {}) {
  return patchConnectorState(id, {
    lastHealth: ok ? "ok" : "fail",
    lastVerifiedAt: new Date().toISOString(),
    toolCount: toolCount ?? undefined,
    lastError: error ? String(error).slice(0, 500) : null,
  });
}

export function buildConnectorEnv(connector) {
  const env = { ...process.env };
  for (const key of connector.envKeys ?? []) {
    const value = getEnvValue(key);
    if (value != null && value !== "") env[key] = value;
  }
  return env;
}

/**
 * Replace `{ENV_KEY}` placeholders in connector args with resolved values.
 * @param {string[]} args
 * @param {Record<string, string>} env
 */
export function resolveConnectorArgs(args, env = {}) {
  return (args ?? []).map((arg) =>
    String(arg).replace(/\{([A-Z][A-Z0-9_]*)\}/g, (match, key) => {
      const value = env[key];
      return value != null && value !== "" ? value : match;
    })
  );
}

/**
 * @param {object} connector
 * @param {Record<string, string>} [envOverrides]
 */
export function buildConnectorLaunchContext(connector, envOverrides = {}) {
  const env = { ...buildConnectorEnv(connector), ...envOverrides };
  return {
    command: connector.command,
    args: resolveConnectorArgs(connector.args, env),
    env,
  };
}

export function resetConnectorsForTests() {
  memoryConnectors.clear();
}
