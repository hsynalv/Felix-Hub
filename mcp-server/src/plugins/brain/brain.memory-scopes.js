/**
 * Memory scope model — maps brain types to LLM-facing scopes.
 */

export const MEMORY_SCOPES = {
  fact: "personal_memory",
  preference: "preferences",
  decision: "decision_log",
  event: "conversation_memory",
  project_note: "project_memory",
};

const STALE_DAYS = 90;
const UNCERTAIN_CONFIDENCE = 0.8;

/**
 * @param {{ type?: string; tags?: string[] }} mem
 */
export function resolveMemoryScope(mem) {
  if (mem.tags?.includes("session-summary")) return "temporary_session_memory";
  if (mem.tags?.includes("habit")) return "preferences";
  return MEMORY_SCOPES[mem.type] || "personal_memory";
}

/**
 * @param {{ createdAt?: string; updatedAt?: string }} mem
 */
export function isStaleMemory(mem) {
  const ts = mem.updatedAt || mem.createdAt;
  if (!ts) return false;
  const ageMs = Date.now() - new Date(ts).getTime();
  return ageMs > STALE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Citation-formatted memory line for LLM context.
 * @param {object} mem
 */
export function formatMemoryCitation(mem) {
  const scope = resolveMemoryScope(mem);
  const conf = typeof mem.confidence === "number" ? mem.confidence.toFixed(2) : "1.00";
  const project = mem.projectId ? ` project=${mem.projectId}` : "";
  const tags = mem.tags?.length ? ` tags=${mem.tags.join(",")}` : "";
  const flags = [];
  if (mem.confidence < UNCERTAIN_CONFIDENCE) flags.push("uncertain");
  if (isStaleMemory(mem)) flags.push("stale");
  const flagStr = flags.length ? ` flags=${flags.join(",")}` : "";

  let advisory = "";
  if (flags.includes("uncertain")) {
    advisory = "\n_Uncertain memory — do not rely without verification._";
  } else if (flags.includes("stale")) {
    advisory = "\n_Stale memory — verify with tools if task depends on current state._";
  }

  return `[memory:${mem.id} scope=${scope} type=${mem.type}${project} confidence=${conf}${tags}${flagStr}]\n${mem.content}${advisory}`;
}
