/**
 * Persist LLM routing configuration from Settings UI
 */

import { upsertSetting, writeConfigAudit } from "./settings.service.js";
import { applyOverlayEntry } from "./effective-config.js";
import { runSettingsReload } from "./reload-registry.js";
import { LLM_KEY_MODES, CHAT_PROVIDERS, ROUTER_PROVIDERS } from "../llm-config.js";

const SECRET_KEYS = {
  unifiedApiKey: "LLM_UNIFIED_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  mistral: "MISTRAL_API_KEY",
  vllmUrl: "VLLM_BASE_URL",
  vllmKey: "VLLM_API_KEY",
};

/**
 * @param {object} body
 * @param {string} [actor]
 */
export async function saveLlmConfig(body, actor = "settings-ui") {
  const changed = [];

  if (body.mode && LLM_KEY_MODES.includes(body.mode)) {
    await upsertSetting("LLM_KEY_MODE", body.mode, { updatedBy: actor });
    applyOverlayEntry("LLM_KEY_MODE", body.mode);
    changed.push("LLM_KEY_MODE");
  }

  if (body.chatProvider && CHAT_PROVIDERS.includes(body.chatProvider)) {
    await upsertSetting("CHAT_LLM_PROVIDER", body.chatProvider, { updatedBy: actor });
    applyOverlayEntry("CHAT_LLM_PROVIDER", body.chatProvider);
    changed.push("CHAT_LLM_PROVIDER");
  }

  if (typeof body.chatModel === "string") {
    await upsertSetting("CHAT_LLM_MODEL", body.chatModel.trim(), { updatedBy: actor });
    applyOverlayEntry("CHAT_LLM_MODEL", body.chatModel.trim());
    changed.push("CHAT_LLM_MODEL");
  }

  if (body.routerProvider && ROUTER_PROVIDERS.includes(body.routerProvider)) {
    await upsertSetting("ROUTER_LLM_PROVIDER", body.routerProvider, { updatedBy: actor });
    applyOverlayEntry("ROUTER_LLM_PROVIDER", body.routerProvider);
    changed.push("ROUTER_LLM_PROVIDER");
  }

  if (typeof body.routerModel === "string") {
    await upsertSetting("ROUTER_LLM_MODEL", body.routerModel.trim(), { updatedBy: actor });
    applyOverlayEntry("ROUTER_LLM_MODEL", body.routerModel.trim());
    changed.push("ROUTER_LLM_MODEL");
  }

  if (body.mode === "unified" && body.unifiedApiKey?.trim()) {
    const key = body.unifiedApiKey.trim();
    await upsertSetting("LLM_UNIFIED_API_KEY", key, { updatedBy: actor });
    await upsertSetting("OPENAI_API_KEY", key, { updatedBy: actor });
    applyOverlayEntry("LLM_UNIFIED_API_KEY", key);
    applyOverlayEntry("OPENAI_API_KEY", key);
    changed.push("LLM_UNIFIED_API_KEY", "OPENAI_API_KEY");
  }

  const providerKeys = body.providerKeys || {};
  for (const [slot, envKey] of Object.entries(SECRET_KEYS)) {
    if (slot === "unifiedApiKey" || slot === "vllmUrl") continue;
    const value = providerKeys[slot];
    if (typeof value === "string" && value.trim()) {
      await upsertSetting(envKey, value.trim(), { updatedBy: actor });
      applyOverlayEntry(envKey, value.trim());
      changed.push(envKey);
    }
  }

  if (typeof providerKeys.vllmUrl === "string" && providerKeys.vllmUrl.trim()) {
    await upsertSetting("VLLM_BASE_URL", providerKeys.vllmUrl.trim(), { updatedBy: actor });
    applyOverlayEntry("VLLM_BASE_URL", providerKeys.vllmUrl.trim());
    changed.push("VLLM_BASE_URL");
  }

  if (typeof body.unifiedModel === "string" && body.unifiedModel.trim()) {
    await upsertSetting("OPENAI_CHAT_MODEL", body.unifiedModel.trim(), { updatedBy: actor });
    applyOverlayEntry("OPENAI_CHAT_MODEL", body.unifiedModel.trim());
    changed.push("OPENAI_CHAT_MODEL");
  }

  if (typeof body.globalInstructions === "string") {
    const text = body.globalInstructions.trim().slice(0, 4_000);
    await upsertSetting("CHAT_GLOBAL_INSTRUCTIONS", text, { updatedBy: actor });
    applyOverlayEntry("CHAT_GLOBAL_INSTRUCTIONS", text);
    changed.push("CHAT_GLOBAL_INSTRUCTIONS");
  }

  await writeConfigAudit({
    operation: "save_llm_config",
    keyName: "llm-routing",
    actor,
  });

  const reload = await runSettingsReload([...new Set(changed)]);
  return { changed: [...new Set(changed)], reload };
}
