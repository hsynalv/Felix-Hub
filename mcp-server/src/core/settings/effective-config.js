/**
 * Runtime config overlay: MSSQL settings_encrypted > process.env > defaults
 */

import { config as baseConfig } from "../config.js";
import { sanitizeConfig } from "../config-schema.js";
import { listAllSettingsDecrypted } from "./settings.service.js";

/** @type {Map<string, string>} */
const overlay = new Map();

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
  if (overlay.has(key)) return overlay.get(key);
  return process.env[key];
}

function applyToProcessEnv(key, value) {
  if (RESTART_REQUIRED_KEYS.has(key)) return false;
  process.env[key] = value;
  return true;
}

export async function loadSettingsOverlay() {
  overlay.clear();
  const rows = await listAllSettingsDecrypted();
  for (const { keyName, value } of rows) {
    overlay.set(keyName, value);
    applyToProcessEnv(keyName, value);
  }
  return overlay.size;
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

export function listOverlayKeys() {
  return [...overlay.keys()].sort();
}
