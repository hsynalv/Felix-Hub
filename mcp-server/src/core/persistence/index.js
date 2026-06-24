/**
 * Hub-internal MSSQL persistence (separate from database plugin pool)
 */

import sql from "mssql";
import { createHash, randomUUID } from "crypto";
import { config } from "../config.js";
import { runMigrations, getSchemaVersion } from "./migrate.js";
import { mssqlConfigFromConnectionString } from "./mssql-config.js";

/** @type {import("mssql").ConnectionPool|null} */
let pool = null;

/** @type {{ enabled: boolean, status: string, schemaVersion: number|null, error: string|null }} */
let status = {
  enabled: false,
  status: "disabled",
  schemaVersion: null,
  error: null,
};

export function isPersistenceEnabled() {
  return config.persistence.enabled === true;
}

export function getPersistenceStatus() {
  return { ...status };
}

export function isPersistenceHealthy() {
  return status.enabled && status.status === "healthy" && pool !== null;
}

function resolveMssqlUrl() {
  return (
    config.persistence.mssqlUrl ||
    config.database.mssqlConnectionString ||
    undefined
  );
}

function buildPoolConfig() {
  const connectionString = resolveMssqlUrl();
  if (!connectionString) {
    throw new Error("HUB_MSSQL_URL or MSSQL_CONNECTION_STRING required when persistence enabled");
  }
  return mssqlConfigFromConnectionString(connectionString);
}

export async function initPersistence() {
  if (!isPersistenceEnabled()) {
    status = { enabled: false, status: "disabled", schemaVersion: null, error: null };
    console.log("[persistence] Disabled (HUB_PERSISTENCE_ENABLED != true)");
    return getPersistenceStatus();
  }

  if (!resolveMssqlUrl()) {
    status = {
      enabled: true,
      status: "degraded",
      schemaVersion: null,
      error: "No HUB_MSSQL_URL or MSSQL_CONNECTION_STRING configured",
    };
    console.warn("[persistence] Enabled but no connection string — degraded mode");
    return getPersistenceStatus();
  }

  try {
    pool = await sql.connect(buildPoolConfig());
    await runMigrations(pool);
    const schemaVersion = await getSchemaVersion(pool);
    status = { enabled: true, status: "healthy", schemaVersion, error: null };
    console.log(`[persistence] Connected — schema v${schemaVersion ?? "?"}`);
  } catch (err) {
    pool = null;
    status = {
      enabled: true,
      status: "degraded",
      schemaVersion: null,
      error: err.message || "Connection failed",
    };
    console.warn(`[persistence] Degraded: ${status.error}`);
  }

  return getPersistenceStatus();
}

export async function reconnectPersistence() {
  if (pool) {
    try {
      await pool.close();
    } catch {
      /* ignore */
    }
    pool = null;
  }
  return initPersistence();
}

export function getPersistencePool() {
  return pool;
}

/**
 * @param {string} queryText
 * @param {Record<string, unknown>} [inputs]
 */
export async function persistenceQuery(queryText, inputs = {}) {
  if (!isPersistenceHealthy() || !pool) return null;
  const request = pool.request();
  for (const [key, value] of Object.entries(inputs)) {
    request.input(key, value);
  }
  return request.query(queryText);
}

/**
 * @param {object} opts
 * @param {string} opts.memoryId
 * @param {string} [opts.namespace]
 * @param {string} [opts.syncTarget]
 * @param {string} [opts.syncStatus]
 * @param {string|null} [opts.contentHash]
 */
export async function upsertMemorySyncState({
  memoryId,
  namespace = "default",
  syncTarget = "mssql_meta",
  syncStatus = "pending",
  contentHash = null,
}) {
  if (!isPersistenceHealthy()) return null;

  await persistenceQuery(
    `
    MERGE memory_sync_state AS target
    USING (SELECT @memoryId AS memory_id, @namespace AS namespace, @syncTarget AS sync_target) AS source
    ON target.memory_id = source.memory_id
       AND target.namespace = source.namespace
       AND target.sync_target = source.sync_target
    WHEN MATCHED THEN
      UPDATE SET
        sync_status = @syncStatus,
        content_hash = COALESCE(@contentHash, target.content_hash),
        updated_at = SYSUTCDATETIME(),
        error_message = NULL
    WHEN NOT MATCHED THEN
      INSERT (memory_id, namespace, sync_target, sync_status, content_hash)
      VALUES (@memoryId, @namespace, @syncTarget, @syncStatus, @contentHash);
    `,
    {
      memoryId,
      namespace,
      syncTarget,
      syncStatus,
      contentHash,
    }
  );
}

/**
 * @param {string} memoryId
 * @param {string} [namespace]
 */
export async function markMemorySyncDeleted(memoryId, namespace = "default") {
  if (!isPersistenceHealthy()) return null;
  await persistenceQuery(
    `
    UPDATE memory_sync_state
    SET sync_status = 'deleted', updated_at = SYSUTCDATETIME()
    WHERE memory_id = @memoryId AND namespace = @namespace
    `,
    { memoryId, namespace }
  );
}

export function hashContent(content) {
  return createHash("sha256").update(String(content)).digest("hex");
}

export { randomUUID };
