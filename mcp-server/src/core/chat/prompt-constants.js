/**
 * V8 — shared prompt registry constants (chat + prompt-registry plugin).
 */

export const STANDARD_SECTION_KEYS = [
  "identity",
  "capabilities",
  "flow",
  "tool_calling",
  "response_style",
  "code_style",
  "context_understanding",
  "memory_injection",
  "preferences_injection",
  "completion_spec",
  "non_compliance",
  "todo_spec",
];

export const SECTION_ORDER = [...STANDARD_SECTION_KEYS];

/** @type {readonly string[]} */
export const CHAT_MODES = ["chat", "agent", "spec", "review", "debug", "ops", "desktop"];

export const DEFAULT_PROMPT_BUNDLE_ID = "felix-default";

export function isChatMode(value) {
  return typeof value === "string" && CHAT_MODES.includes(value);
}
