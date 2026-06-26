/**
 * Lightweight brain intent detection from user messages (no LLM call).
 */

const SAVE_PATTERNS = [
  /\bkaydet\b/i,
  /\bhatırla\b/i,
  /\bunutma\b/i,
  /\bbelleğe\s+(?:yaz|koy|ekle)\b/i,
  /\bremember\b/i,
  /\bsave\s+this\b/i,
  /\bdon'?t\s+forget\b/i,
  /\bstore\s+this\b/i,
];

const RECALL_PATTERNS = [
  /\bşuna\s+bak\b/i,
  /\bne\s+biliyorsun\b/i,
  /\bdaha\s+önce\s+(?:söyle|demiş|kaydet)/i,
  /\bbellekte\s+(?:var\s+mı|ne\s+var)\b/i,
  /\bhatırlıyor\s+musun\b/i,
  /\bwhat\s+do\s+you\s+know\b/i,
  /\blook\s+(?:at|up)\b/i,
  /\brecall\b/i,
  /\bcheck\s+(?:memory|brain)\b/i,
];

/**
 * @param {string} message
 * @returns {{ save: boolean; recall: boolean; explicit: boolean }}
 */
export function detectBrainIntent(message) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return { save: false, recall: false, explicit: false };

  const save = SAVE_PATTERNS.some((p) => p.test(text));
  const recall = RECALL_PATTERNS.some((p) => p.test(text));

  return { save, recall, explicit: save || recall };
}

/**
 * Short system-prompt hint block when intent is detected.
 * @param {string} message
 * @returns {string}
 */
export function buildBrainIntentHint(message) {
  const intent = detectBrainIntent(message);
  if (!intent.explicit) return "";

  const lines = ["## Brain intent (this message)"];

  if (intent.save) {
    lines.push(
      "- User wants to **save** information. Call **brain_remember** once with classified type/tags, then confirm briefly.",
      "- Do not call brain_recall in the same turn unless the save requires prior context."
    );
  }

  if (intent.recall) {
    lines.push(
      "- User wants to **recall** stored knowledge. Passive context may be incomplete across chats — call **brain_recall** or **brain_what_do_you_know_about** once.",
      "- Cross-chat: memories from other conversations exist; use brain tools before answering from chat history alone."
    );
  }

  lines.push(
    "- Limit: at most **one** brain_remember and **one** recall tool per user message. Do not loop."
  );

  return lines.join("\n");
}
