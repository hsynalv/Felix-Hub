/**
 * Hot reload hooks after settings change
 */

import { closeRedis } from "../redis.js";
import { reconnectPersistence } from "../persistence/index.js";
import { HOT_RELOAD_KEYS, RESTART_REQUIRED_KEYS, getOverlay } from "./effective-config.js";

let invalidateLlmClients = async () => {};
let reloadDatabasePool = async () => {};

export function registerReloadHooks({ llmClients, databasePool } = {}) {
  if (llmClients) invalidateLlmClients = llmClients;
  if (databasePool) reloadDatabasePool = databasePool;
}

/**
 * @param {string[]} [changedKeys]
 */
export async function runSettingsReload(changedKeys = null) {
  const keys = changedKeys ?? [...getOverlay().keys()];
  const results = { reloaded: [], skipped: [], errors: [] };

  const needsRestart = keys.filter((k) => RESTART_REQUIRED_KEYS.has(k));
  if (needsRestart.length) {
    results.skipped.push(...needsRestart.map((k) => ({ key: k, reason: "restart_required" })));
  }

  const hotKeys = keys.filter((k) => HOT_RELOAD_KEYS.has(k));

  const llmHotKeys = new Set([
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
  ]);

  if (hotKeys.some((k) => llmHotKeys.has(k))) {
    try {
      await invalidateLlmClients();
      results.reloaded.push("llm-router");
    } catch (e) {
      results.errors.push({ target: "llm-router", message: e.message });
    }
  }

  if (hotKeys.includes("REDIS_URL")) {
    try {
      await closeRedis();
      results.reloaded.push("redis");
    } catch (e) {
      results.errors.push({ target: "redis", message: e.message });
    }
  }

  if (hotKeys.includes("HUB_MSSQL_URL")) {
    try {
      await reconnectPersistence();
      results.reloaded.push("persistence");
    } catch (e) {
      results.errors.push({ target: "persistence", message: e.message });
    }
  }

  if (hotKeys.includes("MSSQL_CONNECTION_STRING")) {
    try {
      await reloadDatabasePool();
      results.reloaded.push("database-mssql");
    } catch (e) {
      results.errors.push({ target: "database-mssql", message: e.message });
    }
  }

  const notionHotKeys = new Set([
    "NOTION_API_KEY",
    "NOTION_PROJECTS_DB_ID",
    "NOTION_PROJECTS_DATA_SOURCE_ID",
    "NOTION_TASKS_DB_ID",
    "NOTION_TASKS_DATA_SOURCE_ID",
    "NOTION_TASK_DATABASE_ID",
  ]);

  if (hotKeys.some((k) => notionHotKeys.has(k))) {
    results.reloaded.push("notion");
    try {
      const { clearNotionDataSourceCache } = await import("../plugins/notion/notion-database-parent.js");
      clearNotionDataSourceCache();
    } catch {
      // ignore
    }
  }

  if (hotKeys.includes("intent_training.config")) {
    try {
      const { refreshIntentTrainConfigCache } = await import("../chat/tool-intent-config.js");
      await refreshIntentTrainConfigCache();
      results.reloaded.push("intent-training");
    } catch (e) {
      results.errors.push({ target: "intent-training", message: e.message });
    }
  }

  if (
    hotKeys.includes("TELEGRAM_BOT_TOKEN") ||
    hotKeys.includes("TELEGRAM_CHAT_ID") ||
    hotKeys.includes("TELEGRAM_ALLOWED_CHAT_IDS")
  ) {
    results.reloaded.push("telegram");
  }

  return results;
}
