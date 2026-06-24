/**
 * Resolve Notion database IDs to data_source_id for page create / query (API 2025-09-03).
 * @see https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03
 */

import { notionRequest, NOTION_VERSION_LATEST } from "./notion.client.js";
import { normalizeNotionId } from "./notion-ids.js";
import { getEnvValue } from "../../core/settings/effective-config.js";

/** @type {Map<string, string>} databaseId -> dataSourceId */
const dataSourceCache = new Map();

export function clearNotionDataSourceCache() {
  dataSourceCache.clear();
}

function getDataSourceOverride(databaseId) {
  const dbId = normalizeNotionId(databaseId);
  const projectsDb = normalizeNotionId(getEnvValue("NOTION_PROJECTS_DB_ID") || "");
  const tasksDb = normalizeNotionId(
    getEnvValue("NOTION_TASKS_DB_ID") || getEnvValue("NOTION_TASK_DATABASE_ID") || ""
  );

  if (dbId && dbId === projectsDb) {
    const override = getEnvValue("NOTION_PROJECTS_DATA_SOURCE_ID");
    if (override) return normalizeNotionId(override);
  }
  if (dbId && dbId === tasksDb) {
    const override = getEnvValue("NOTION_TASKS_DATA_SOURCE_ID");
    if (override) return normalizeNotionId(override);
  }
  return null;
}

/**
 * @param {unknown} details
 * @returns {string[]}
 */
export function extractDataSourceIdsFromNotionError(details) {
  if (!details || typeof details !== "object") return [];

  const body = details.body;
  if (body && typeof body === "object") {
    if (Array.isArray(body.data_source_ids)) return body.data_source_ids.map(String);
    if (Array.isArray(body.additional_data?.data_source_ids)) {
      return body.additional_data.data_source_ids.map(String);
    }
  }

  const message = String(details.message || "");
  const jsonStart = message.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(message.slice(jsonStart));
      if (Array.isArray(parsed.data_source_ids)) return parsed.data_source_ids.map(String);
    } catch {
      // ignore
    }
  }
  return [];
}

export function isDatabaseParentMigrationError(result) {
  const message = String(result?.details?.message || result?.error || "").toLowerCase();
  return (
    message.includes("data_source") ||
    message.includes("database_id") && message.includes("not a database") ||
    message.includes("use the blocks api")
  );
}

/**
 * List data sources for a database (discovery helper for settings UI / debugging).
 * @param {string} databaseId
 */
export async function listDatabaseDataSources(databaseId) {
  const dbId = normalizeNotionId(databaseId);
  if (!dbId) {
    return { ok: false, error: "invalid_database_id", details: { message: "Geçersiz database ID" } };
  }

  const override = getDataSourceOverride(dbId);
  if (override) {
    return {
      ok: true,
      data: {
        databaseId: dbId,
        dataSources: [{ id: override, name: "(NOTION_*_DATA_SOURCE_ID override)" }],
        source: "env_override",
      },
    };
  }

  const discovery = await notionRequest("GET", `/databases/${dbId}`, null, {
    notionVersion: NOTION_VERSION_LATEST,
  });

  if (!discovery.ok) {
    const msg = discovery.details?.message || "";
    if (msg.includes("data sources accessible")) {
      return {
        ok: false,
        error: "notion_integration_not_connected",
        details: {
          message:
            'Notion entegrasyonu (mcp-hub) bu veritabanına bağlı değil. Notion\'da veritabanını aç → sağ üst ⋯ → Bağlantılar / Connections → "mcp-hub" ekle.',
          databaseId: dbId,
          notionMessage: msg,
        },
      };
    }
    return discovery;
  }

  const dataSources = (discovery.data?.data_sources ?? []).map((ds) => ({
    id: ds.id,
    name: ds.name ?? "",
  }));

  if (dataSources.length === 0) {
    return {
      ok: false,
      error: "notion_no_data_sources",
      details: {
        message:
          'Veritabanı bulundu ama entegrasyon erişemiyor. Notion\'da veritabanını aç → ⋯ → Connections → "mcp-hub" entegrasyonunu ekle veya yeniden bağla.',
        databaseId: dbId,
      },
    };
  }

  if (dataSources.length === 1) {
    dataSourceCache.set(dbId, dataSources[0].id);
  }

  return {
    ok: true,
    data: {
      databaseId: dbId,
      title: discovery.data?.title,
      dataSources,
      source: "api",
    },
  };
}

/**
 * Resolve a configured database ID to its primary data source ID.
 * @param {string} databaseId
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<string|null>}
 */
export async function resolveDataSourceId(databaseId, options = {}) {
  const dbId = normalizeNotionId(databaseId);
  if (!dbId) return null;

  const override = getDataSourceOverride(dbId);
  if (override) {
    dataSourceCache.set(dbId, override);
    return override;
  }

  if (!options.force && dataSourceCache.has(dbId)) {
    return dataSourceCache.get(dbId);
  }

  const discovery = await notionRequest("GET", `/databases/${dbId}`, null, {
    notionVersion: NOTION_VERSION_LATEST,
  });

  if (discovery.ok) {
    const sources = discovery.data?.data_sources;
    if (Array.isArray(sources) && sources.length > 0 && sources[0]?.id) {
      dataSourceCache.set(dbId, sources[0].id);
      return sources[0].id;
    }
    if (Array.isArray(sources) && sources.length === 0) {
      return null;
    }
  } else {
    const msg = discovery.details?.message || "";
    if (msg.includes("data sources accessible")) {
      return null;
    }
  }

  return null;
}

/**
 * Parent object for POST /pages when adding a row to a database.
 * @param {string} databaseId
 */
export async function getDatabasePageParent(databaseId) {
  const dbId = normalizeNotionId(databaseId);
  const dataSourceId = await resolveDataSourceId(dbId);

  if (dataSourceId) {
    return { type: "data_source_id", data_source_id: dataSourceId };
  }

  return { database_id: dbId };
}

/**
 * Create a row (page) in a Notion database with data_source_id migration handling.
 * @param {string} databaseId
 * @param {object} properties
 */
export async function createNotionDatabaseRow(databaseId, properties) {
  const dbId = normalizeNotionId(databaseId);
  if (!dbId) {
    return { ok: false, error: "invalid_database_id", details: { message: "Geçersiz database ID" } };
  }

  async function createWithParent(parent) {
    const useLatest =
      parent.type === "data_source_id" || Boolean(parent.data_source_id);
    return notionRequest(
      "POST",
      "/pages",
      { parent, properties },
      useLatest ? { notionVersion: NOTION_VERSION_LATEST } : {}
    );
  }

  let dataSourceId = await resolveDataSourceId(dbId);
  let result = await createWithParent(
    dataSourceId
      ? { type: "data_source_id", data_source_id: dataSourceId }
      : { database_id: dbId }
  );

  if (result.ok || !isDatabaseParentMigrationError(result)) {
    return result;
  }

  clearNotionDataSourceCache();
  dataSourceId = await resolveDataSourceId(dbId, { force: true });

  const hintIds = extractDataSourceIdsFromNotionError(result.details);
  if (!dataSourceId && hintIds.length) {
    dataSourceId = normalizeNotionId(hintIds[0]);
    dataSourceCache.set(dbId, dataSourceId);
  }

  if (dataSourceId) {
    result = await createWithParent({ type: "data_source_id", data_source_id: dataSourceId });
    if (result.ok) return result;
  }

  const listed = await listDatabaseDataSources(dbId);
  if (!listed.ok) {
    return listed;
  }

  const available = listed.data?.dataSources ?? [];

  return {
    ok: false,
    error: "notion_data_source_required",
    details: {
      message:
        available.length > 0
          ? `Notion data_source_id gerekli. Ayarlara NOTION_PROJECTS_DATA_SOURCE_ID veya NOTION_TASKS_DATA_SOURCE_ID olarak şunu girin: ${available[0].id}`
          : "Notion artık database_id ile satır oluşturmayı kabul etmiyor. Veritabanında ⋯ → Connections → mcp-hub entegrasyonunu ekleyin; ardından Copy data source ID ile NOTION_*_DATA_SOURCE_ID ayarlayın.",
      databaseId: dbId,
      dataSources: available,
      notionMessage: result.details?.message,
    },
  };
}

/**
 * Query rows in a database (uses data_sources API when available).
 * @param {string} databaseId
 * @param {object} payload
 */
export async function queryNotionDatabase(databaseId, payload) {
  const dbId = normalizeNotionId(databaseId);
  const dataSourceId = await resolveDataSourceId(dbId);

  if (dataSourceId) {
    return notionRequest("POST", `/data_sources/${dataSourceId}/query`, payload, {
      notionVersion: NOTION_VERSION_LATEST,
    });
  }

  return notionRequest("POST", `/databases/${dbId}/query`, payload);
}
