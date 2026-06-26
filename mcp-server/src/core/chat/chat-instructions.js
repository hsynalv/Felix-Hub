/**
 * Per-conversation chat instructions helpers
 */

import { getEnvValue } from "../settings/effective-config.js";

const RESPONSE_STYLE_SUFFIX = {
  concise: "Yanıtlarını kısa ve öz tut. Gereksiz tekrar yapma.",
  detailed: "Yanıtlarını ayrıntılı ve örneklerle destekleyerek ver.",
};

const MAX_INSTRUCTIONS_LENGTH = 4000;

export function getGlobalChatInstructions() {
  return (getEnvValue("CHAT_GLOBAL_INSTRUCTIONS") || "").trim();
}

export function normalizeConversationMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return {};
  return metadata;
}

export function buildInstructionsBlock(metadata = {}, explicitSystemPrompt, explicitResponseStyle) {
  const parts = [];

  const global = getGlobalChatInstructions();
  if (global) {
    parts.push(global.slice(0, MAX_INSTRUCTIONS_LENGTH));
  }

  const instructions =
    typeof explicitSystemPrompt === "string" && explicitSystemPrompt.trim()
      ? explicitSystemPrompt.trim()
      : typeof metadata.instructions === "string"
        ? metadata.instructions.trim()
        : "";

  if (instructions) {
    parts.push(instructions.slice(0, MAX_INSTRUCTIONS_LENGTH));
  }

  const style = explicitResponseStyle || metadata.responseStyle;
  if (style && RESPONSE_STYLE_SUFFIX[style]) {
    parts.push(RESPONSE_STYLE_SUFFIX[style]);
  }

  return parts.filter(Boolean).join("\n\n");
}

export function resolveIncludeBrainContext(metadata = {}, bodyValue) {
  if (typeof bodyValue === "boolean") return bodyValue;
  if (typeof metadata.includeBrainContext === "boolean") return metadata.includeBrainContext;
  return true;
}
