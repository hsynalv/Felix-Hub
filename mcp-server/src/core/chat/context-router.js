/**
 * Brain context router — decides what context to inject per message.
 */

import { detectBrainIntent } from "./brain-intent.js";

const PERSONAL_PATTERNS = [
  /\bbana\s+göre\b/i,
  /\btercih(?:im|lerim)\b/i,
  /\bhow\s+i\s+(?:like|prefer|work)\b/i,
  /\bmy\s+(?:style|preference)\b/i,
  /\bkişisel\b/i,
];

const PROJECT_PATTERNS = [
  /\bbu\s+projede\b/i,
  /\bprojede\s+ne\b/i,
  /\bthis\s+project\b/i,
  /\bproject\s+(?:status|context)\b/i,
  /\bmcp-hub\b/i,
];

const CONVERSATION_PATTERNS = [
  /\bdaha\s+önce\s+konuş/i,
  /\baz\s+önce\s+(?:söyled|dedi)/i,
  /\bearlier\s+in\s+(?:this\s+)?chat\b/i,
  /\bwe\s+(?:discussed|talked)\b/i,
];

const CODE_TASK_PATTERNS = [
  /\b(?:kod|code|implement|refactor|fix|bug|test|deploy)\b/i,
  /\b(?:yaz|oluştur|ekle)\b.*\b(?:fonksiyon|component|api|endpoint)\b/i,
];

const GENERAL_QUESTION = [
  /^(?:merhaba|selam|hello|hi|hey)\b/i,
  /^(?:nasılsın|how are you)\b/i,
  /^(?:teşekkür|thanks)\b/i,
];

/**
 * @param {string} message
 * @param {{ projectId?: string | null; hasConversationHistory?: boolean }} [opts]
 */
export function analyzeContextNeeds(message, opts = {}) {
  const text = typeof message === "string" ? message.trim() : "";
  const brainIntent = detectBrainIntent(text);
  const hasHistory = opts.hasConversationHistory === true;
  const hasProject = !!opts.projectId;

  const reasons = [];

  if (!text) {
    return {
      needsPersonalMemory: false,
      needsProjectMemory: false,
      needsSemanticRecall: false,
      needsBrainToolRecall: false,
      needsPreferences: false,
      conversationSufficient: true,
      skipBrainContext: true,
      reasons: ["empty_message"],
    };
  }

  const isGeneral = GENERAL_QUESTION.some((p) => p.test(text));
  if (isGeneral && text.length < 40) {
    return {
      needsPersonalMemory: false,
      needsProjectMemory: false,
      needsSemanticRecall: false,
      needsBrainToolRecall: false,
      needsPreferences: false,
      conversationSufficient: true,
      skipBrainContext: true,
      reasons: ["general_greeting"],
    };
  }

  const needsPersonal =
    PERSONAL_PATTERNS.some((p) => p.test(text)) || brainIntent.recall;
  const needsProject =
    hasProject ||
    PROJECT_PATTERNS.some((p) => p.test(text)) ||
    CODE_TASK_PATTERNS.some((p) => p.test(text));
  const needsConversation =
    CONVERSATION_PATTERNS.some((p) => p.test(text)) && hasHistory;
  const needsSemantic = !isGeneral && (needsPersonal || needsProject || brainIntent.recall || text.length > 12);
  const needsBrainTool = brainIntent.explicit || (needsPersonal && !hasHistory);

  if (needsPersonal) reasons.push("personal_context");
  if (needsProject) reasons.push("project_context");
  if (needsConversation) reasons.push("conversation_history");
  if (needsSemantic) reasons.push("semantic_recall");
  if (brainIntent.save) reasons.push("brain_save_intent");
  if (brainIntent.recall) reasons.push("brain_recall_intent");

  const conversationSufficient = needsConversation && !needsSemantic && !brainIntent.recall;

  return {
    needsPersonalMemory: needsPersonal,
    needsProjectMemory: needsProject,
    needsSemanticRecall: needsSemantic,
    needsBrainToolRecall: needsBrainTool,
    needsPreferences: needsPersonal || PERSONAL_PATTERNS.some((p) => p.test(text)),
    conversationSufficient,
    skipBrainContext: conversationSufficient && !needsSemantic && !needsProject,
    reasons,
  };
}

/**
 * Build a human-readable router summary for the system prompt.
 * @param {ReturnType<typeof analyzeContextNeeds>} route
 */
export function buildContextRouterHint(route) {
  if (route.skipBrainContext) {
    return "## Context router\nNo brain/project context needed for this message. Answer from conversation or general knowledge.";
  }

  const lines = ["## Context router", `Strategy: ${route.reasons.join(", ") || "default"}`];

  if (route.needsPreferences) {
    lines.push("- Include **preferences** and user profile when personalizing.");
  }
  if (route.needsProjectMemory) {
    lines.push("- Prioritize **project_memory** scoped to the active project.");
  }
  if (route.needsSemanticRecall) {
    lines.push("- Semantic memories below are pre-fetched; call **brain_recall** if insufficient.");
  }
  if (route.needsBrainToolRecall) {
    lines.push("- Cross-chat memory may exist — verify with brain tools before answering.");
  }

  lines.push(
    "",
    "### Memory scopes",
    "- `personal_memory` / `preferences` — user identity and style only.",
    "- `project_memory` — active project facts (prioritized when project selected).",
    "- `decision_log` — architecture/product decisions.",
    "- `conversation_memory` — time-bound events; may be stale.",
    "- Chat history = recent flow only; not long-term memory."
  );

  return lines.join("\n");
}
