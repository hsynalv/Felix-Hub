/**
 * Build structured intent decision envelope for logging/training.
 */

/**
 * @param {object} opts
 */
export function buildIntentDecisionEnvelope(opts) {
  const {
    rawClassification,
    effectiveIntent,
    chatProfile,
    profileOverride,
    toolCount,
    guardBlocks,
    pluginFilter,
  } = opts;

  return {
    rawIntent: rawClassification?.rawIntent ?? rawClassification?.intent ?? null,
    effectiveIntent: effectiveIntent ?? null,
    rawConfidence: rawClassification?.confidence ?? null,
    source: rawClassification?.source ?? "regex",
    regex: rawClassification?.regex ?? null,
    nlp: rawClassification?.nlp ?? null,
    modelVersion: rawClassification?.modelVersion ?? null,
    chatProfile: chatProfile ?? null,
    profileOverride: profileOverride ?? false,
    toolCount: toolCount ?? 0,
    guardBlocks: guardBlocks ?? [],
    pluginFilter: pluginFilter ?? null,
    at: new Date().toISOString(),
  };
}

/**
 * @param {string} toolIntent
 * @param {string} [chatProfile]
 */
export function shouldDisableChatTools(toolIntent, chatProfile) {
  const profile = chatProfile || "balanced";
  if (profile === "answer_only") return true;
  if (toolIntent === "no_tool") return true;
  return false;
}

/**
 * Tool families blocked on intent mismatch regardless of read/write.
 */

import { toolMatchesIntent } from "./tool-intent.js";

/**
 * @param {string} toolName
 * @param {string} intent
 */
export function isRiskyIntentMismatch(toolName, intent) {
  if (!intent || intent === "general" || intent === "no_tool") return false;
  if (toolMatchesIntent(intent, toolName)) return false;

  if (toolName.startsWith("n8n_")) return true;
  if (toolName.startsWith("http_") || toolName.startsWith("openapi_")) return true;
  if (toolName.startsWith("shell_")) return true;
  if (toolName.startsWith("workspace_write") || toolName.startsWith("workspace_apply")) return true;
  if (toolName.startsWith("brain_remember") || toolName.startsWith("brain_update") || toolName.startsWith("brain_forget")) {
    return true;
  }
  return false;
}
