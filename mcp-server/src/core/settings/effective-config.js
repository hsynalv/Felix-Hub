/**
 * Runtime config overlay: MSSQL settings_encrypted > process.env > defaults
 */

import { config as baseConfig } from "../config.js";
import { sanitizeConfig } from "../config-schema.js";
import { listAllSettingsDecrypted } from "./settings.service.js";
import { getRequestContext, userNamespaceForId } from "../auth/request-context.js";
import { getTenantOverlaySync } from "../auth/tenant-overlay.js";
import { isPersistenceHealthy, persistenceQuery } from "../persistence/index.js";

/** @type {Map<string, string>} */
const overlay = new Map();

/** @type {Map<string, string>} */
const ownerIntegrationOverlay = new Map();

/** Loaded from owner user namespace for webhooks, schedulers, and outbound without request context */
export const OWNER_INTEGRATION_KEYS = new Set([
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "TELEGRAM_ALLOWED_CHAT_IDS",
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_NOTIFY_UI_TOKEN",
  "TELEGRAM_CHAT_PROFILE",
  "TELEGRAM_AUTO_APPROVE_TOOLS",
  "TELEGRAM_RATE_LIMIT_PER_MIN",
  "TELEGRAM_WORKING_ACK_DELAY_MS",
  "TELEGRAM_POLLING",
]);

export const BOOTSTRAP_KEYS = new Set([
  "PORT",
  "NODE_ENV",
  "HUB_READ_KEY",
  "HUB_WRITE_KEY",
  "HUB_ADMIN_KEY",
  "HUB_MSSQL_URL",
  "HUB_SETTINGS_MASTER_KEY",
  "HUB_PERSISTENCE_ENABLED",
  "MSSQL_CONNECTION_STRING",
  "HUB_SEED_EMAIL",
  "HUB_SEED_PASSWORD",
  "HUB_SEED_DISPLAY_NAME",
]);

export const RESTART_REQUIRED_KEYS = new Set([
  "PORT",
  "HUB_READ_KEY",
  "HUB_WRITE_KEY",
  "HUB_ADMIN_KEY",
  "NODE_ENV",
]);

export const HOT_RELOAD_KEYS = new Set([
  "LLM_KEY_MODE",
  "LLM_UNIFIED_API_KEY",
  "CHAT_LLM_PROVIDER",
  "CHAT_LLM_MODEL",
  "ROUTER_LLM_PROVIDER",
  "ROUTER_LLM_MODEL",
  "OPENAI_API_KEY",
  "OPENAI_CHAT_MODEL",
  "ANTHROPIC_API_KEY",
  "GOOGLE_API_KEY",
  "MISTRAL_API_KEY",
  "OLLAMA_BASE_URL",
  "OLLAMA_MODEL",
  "VLLM_BASE_URL",
  "VLLM_API_KEY",
  "VLLM_MODEL",
  "VLLM_MODELS",
  "NOTION_API_KEY",
  "NOTION_ROOT_PAGE_ID",
  "NOTION_PROJECTS_DB_ID",
  "NOTION_TASKS_DB_ID",
  "REDIS_URL",
  "HUB_MSSQL_URL",
  "MSSQL_CONNECTION_STRING",
  "N8N_API_KEY",
  "N8N_BASE_URL",
  "GITHUB_TOKEN",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "TELEGRAM_ALLOWED_CHAT_IDS",
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_NOTIFY_UI_TOKEN",
  "TELEGRAM_POLLING",
  "TELEGRAM_CHAT_PROFILE",
  "TELEGRAM_AUTO_APPROVE_TOOLS",
]);

export function getOverlay() {
  return overlay;
}

export function setOverlayEntry(key, value) {
  overlay.set(key, value);
}

export function deleteOverlayEntry(key) {
  overlay.delete(key);
}

export function getEnvValue(key) {
  if (BOOTSTRAP_KEYS.has(key)) {
    return process.env[key];
  }
  const ctx = getRequestContext();
  if (ctx?.namespace) {
    const tenant = getTenantOverlaySync(ctx.namespace);
    if (tenant?.has(key)) return tenant.get(key);
  }
  if (overlay.has(key)) return overlay.get(key);
  if (ownerIntegrationOverlay.has(key)) return ownerIntegrationOverlay.get(key);
  return process.env[key];
}

export function applyToProcessEnvForTenant(key, value) {
  if (BOOTSTRAP_KEYS.has(key) || RESTART_REQUIRED_KEYS.has(key)) return false;
  process.env[key] = value;
  return true;
}

function applyToProcessEnv(key, value) {
  if (RESTART_REQUIRED_KEYS.has(key) || BOOTSTRAP_KEYS.has(key)) return false;
  process.env[key] = value;
  return true;
}

export async function loadSettingsOverlay() {
  overlay.clear();
  const rows = await listAllSettingsDecrypted("default");
  for (const { keyName, value } of rows) {
    if (BOOTSTRAP_KEYS.has(keyName)) continue;
    overlay.set(keyName, value);
    applyToProcessEnv(keyName, value);
  }
  return overlay.size;
}

/**
 * Owner-scoped integration keys (Telegram, …) for webhooks and background jobs without tenant context.
 */
export async function loadOwnerIntegrationOverlay() {
  ownerIntegrationOverlay.clear();
  if (!isPersistenceHealthy()) return 0;

  const result = await persistenceQuery(
    `SELECT TOP 1 id FROM hub_users ORDER BY CASE WHEN role = 'owner' THEN 0 ELSE 1 END, created_at ASC`
  );
  const ownerId = result?.recordset?.[0]?.id;
  if (!ownerId) return 0;

  const namespace = userNamespaceForId(ownerId);
  const rows = await listAllSettingsDecrypted(namespace);
  let count = 0;
  for (const { keyName, value } of rows) {
    if (!OWNER_INTEGRATION_KEYS.has(keyName)) continue;
    ownerIntegrationOverlay.set(keyName, value);
    applyToProcessEnv(keyName, value);
    count++;
  }
  if (count > 0) {
    console.log(`[settings] Loaded ${count} owner integration key(s) (webhook/background)`);
  }
  return count;
}

export function clearOwnerIntegrationOverlayForTests() {
  ownerIntegrationOverlay.clear();
}

export function applyOverlayEntry(key, value) {
  overlay.set(key, value);
  return applyToProcessEnv(key, value);
}

export function removeOverlayEntry(key) {
  overlay.delete(key);
  delete process.env[key];
}

export function getEffectiveConfig() {
  const port = Number(getEnvValue("PORT")) || baseConfig.port;
  const merged = {
    ...baseConfig,
    port,
    notion: {
      ...baseConfig.notion,
      apiKey: getEnvValue("NOTION_API_KEY") || baseConfig.notion.apiKey,
      rootPageId: getEnvValue("NOTION_ROOT_PAGE_ID") || baseConfig.notion.rootPageId,
      projectsDbId: getEnvValue("NOTION_PROJECTS_DB_ID") || baseConfig.notion.projectsDbId,
      tasksDbId: getEnvValue("NOTION_TASKS_DB_ID") || baseConfig.notion.tasksDbId,
    },
    redis: {
      ...baseConfig.redis,
      url: getEnvValue("REDIS_URL") || baseConfig.redis.url,
      enabled: !!(getEnvValue("REDIS_URL") || baseConfig.redis.url),
    },
    database: {
      ...baseConfig.database,
      mssqlConnectionString:
        getEnvValue("MSSQL_CONNECTION_STRING") || baseConfig.database.mssqlConnectionString,
      pgConnectionString:
        getEnvValue("PG_CONNECTION_STRING") || baseConfig.database.pgConnectionString,
      mongodbUri: getEnvValue("MONGODB_URI") || baseConfig.database.mongodbUri,
    },
    persistence: {
      ...baseConfig.persistence,
      mssqlUrl: getEnvValue("HUB_MSSQL_URL") || baseConfig.persistence.mssqlUrl,
    },
    n8n: {
      ...baseConfig.n8n,
      apiKey: getEnvValue("N8N_API_KEY") || baseConfig.n8n.apiKey,
      baseUrl: getEnvValue("N8N_BASE_URL") || baseConfig.n8n.baseUrl,
    },
    openai: {
      apiKey: getEnvValue("OPENAI_API_KEY") || "",
    },
  };
  return merged;
}

export function getEffectiveConfigMasked() {
  return sanitizeConfig(getEffectiveConfig());
}

/** Runtime n8n config (respects per-user settings overlay). */
export function getN8nConfig() {
  return {
    baseUrl: getEnvValue("N8N_BASE_URL") || baseConfig.n8n?.baseUrl || "http://n8n:5678",
    apiBase: getEnvValue("N8N_API_BASE") || baseConfig.n8n?.apiBase || "/api/v1",
    apiKey: getEnvValue("N8N_API_KEY") || baseConfig.n8n?.apiKey || undefined,
    allowWrite: getEnvValue("ALLOW_N8N_WRITE") === "true" || baseConfig.n8n?.allowWrite === true,
  };
}

export function listOverlayKeys() {
  return [...overlay.keys()].sort();
}
