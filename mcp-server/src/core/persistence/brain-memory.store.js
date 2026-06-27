/**
 * Brain memory persistence — MSSQL source of truth.
 */

import { persistenceQuery, isPersistenceHealthy } from "./index.js";

export function isBrainDbSourceOfTruth() {
  if (process.env.BRAIN_DB_SOURCE_OF_TRUTH === "false") return false;
  if (process.env.BRAIN_DB_SOURCE_OF_TRUTH === "true") return true;
  return process.env.NODE_ENV === "production";
}

/**
 * @param {object} mem
 */
export async function insertBrainMemory(mem) {
  if (!isPersistenceHealthy()) return null;
  await persistenceQuery(
    `
    INSERT INTO brain_memories (
      id, namespace, content, memory_type, tags_json, project_id,
      importance, confidence, source, metadata_json, created_at, updated_at
    ) VALUES (
      @id, @namespace, @content, @memoryType, @tagsJson, @projectId,
      @importance, @confidence, @source, @metadataJson, @createdAt, @updatedAt
    )
    `,
    {
      id: mem.id,
      namespace: mem.namespace || "default",
      content: mem.content,
      memoryType: mem.type || "fact",
      tagsJson: JSON.stringify(mem.tags || []),
      projectId: mem.projectId || null,
      importance: mem.importance ?? 0.5,
      confidence: mem.confidence ?? 1,
      source: mem.source || "user",
      metadataJson: mem.metadata ? JSON.stringify(mem.metadata) : null,
      createdAt: mem.createdAt,
      updatedAt: mem.updatedAt,
    }
  );
  return mem;
}

/**
 * @param {string} id
 * @param {string} namespace
 */
export async function getBrainMemoryFromDb(id, namespace = "default") {
  if (!isPersistenceHealthy()) return null;
  const result = await persistenceQuery(
    `
    SELECT TOP 1 *
    FROM brain_memories
    WHERE id = @id AND namespace = @namespace AND deleted_at IS NULL
    `,
    { id, namespace }
  );
  const row = result.recordset?.[0];
  if (!row) return null;
  return rowToMemory(row);
}

/**
 * @param {string} namespace
 * @param {number} [limit]
 */
export async function listBrainMemoriesFromDb(namespace = "default", limit = 500) {
  if (!isPersistenceHealthy()) return [];
  const result = await persistenceQuery(
    `
    SELECT TOP (@limit) *
    FROM brain_memories
    WHERE namespace = @namespace AND deleted_at IS NULL
    ORDER BY updated_at DESC
    `,
    { namespace, limit }
  );
  return (result.recordset || []).map(rowToMemory);
}

/**
 * @param {string} id
 * @param {string} namespace
 * @param {object} fields
 */
export async function updateBrainMemoryInDb(id, namespace, fields) {
  if (!isPersistenceHealthy()) return null;
  const existing = await getBrainMemoryFromDb(id, namespace);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...fields,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };
  await persistenceQuery(
    `
    UPDATE brain_memories SET
      content = @content,
      memory_type = @memoryType,
      tags_json = @tagsJson,
      project_id = @projectId,
      importance = @importance,
      confidence = @confidence,
      source = @source,
      updated_at = @updatedAt
    WHERE id = @id AND namespace = @namespace AND deleted_at IS NULL
    `,
    {
      id,
      namespace,
      content: updated.content,
      memoryType: updated.type,
      tagsJson: JSON.stringify(updated.tags || []),
      projectId: updated.projectId || null,
      importance: updated.importance,
      confidence: updated.confidence,
      source: updated.source,
      updatedAt: updated.updatedAt,
    }
  );
  return updated;
}

/**
 * @param {string} id
 * @param {string} namespace
 */
export async function softDeleteBrainMemoryInDb(id, namespace = "default") {
  if (!isPersistenceHealthy()) return false;
  const result = await persistenceQuery(
    `
    UPDATE brain_memories
    SET deleted_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
    WHERE id = @id AND namespace = @namespace AND deleted_at IS NULL
    `,
    { id, namespace }
  );
  return (result.rowsAffected?.[0] ?? 0) > 0;
}

function rowToMemory(row) {
  let tags = [];
  try {
    tags = row.tags_json ? JSON.parse(row.tags_json) : [];
  } catch {
    tags = [];
  }
  return {
    id: String(row.id),
    content: row.content,
    type: row.memory_type,
    tags,
    projectId: row.project_id,
    importance: row.importance,
    confidence: row.confidence,
    source: row.source,
    createdAt: row.created_at?.toISOString?.() || String(row.created_at),
    updatedAt: row.updated_at?.toISOString?.() || String(row.updated_at),
    namespace: row.namespace,
  };
}
