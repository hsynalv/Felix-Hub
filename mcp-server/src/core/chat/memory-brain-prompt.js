/**
 * V8 Faz B — memory / brain prompt hardening (profile-aware).
 */

/** Core memory contract — aligned with brain tool caps in chat-orchestrator. */
export const MEMORY_BEHAVIOR_CORE = `## Brain memory contract
- **Create (brain_remember):** only when user explicitly asks to save/remember OR a durable decision/preference must survive future sessions.
- **Recall:** for personal/project facts, call recall tools before answering — chat history is not long-term memory.
- **Update:** when new info contradicts stored memory, use update/forget flow — do not silently overwrite.
- **Delete (brain_forget):** when user says "unut", "forget", "sil bellekten".
- **Citation:** use \`[memory:id]\` when citing injected Brain Context lines.
- **Provenance:** if asked "nereden biliyorsun?", answer with memory id, type, and scope.
- **Low confidence:** if citation shows low confidence or stale date, say uncertainty explicitly.

### Per-message limits (enforced by server)
- At most **1× brain_remember** and **1×** recall tool combined per user message.
- After save/recall, answer the user — do not call the same brain tool again.`;

/** @type {Record<string, string>} */
const PROFILE_MEMORY_OVERLAYS = {
  personal_assistant: `### Profile: personal assistant
- **brain_save** intent is active — save preferences, decisions, and durable personal facts when appropriate.
- Proactively recall before answering "what do you know about me/my projects".`,

  research: `### Profile: research
- **Recall only** — do not call **brain_remember** unless the user explicitly asks to save.
- Prefer **brain_recall** + read-only tools for investigation.`,

  answer_only: `### Profile: answer only
- Do not call brain tools unless the user explicitly requests save/recall in this message.`,

  safe: `### Profile: safe
- Recall allowed; **no brain_remember** unless user explicitly says save/remember.`,

  spec_planner: `### Profile: spec
- Do not save spec drafts to brain unless user asks — keep artifacts in the reply.`,

  telegram_assistant: `### Profile: Telegram
- Keep brain saves brief; confirm with one line after **brain_remember**.
- Felix Desktop: **always call** desktop_focus_app / clipboard_read / fs_* — never refuse without trying; approval uses inline Onayla/Reddet buttons.`,
};

/**
 * @param {string} [profileId]
 * @returns {string}
 */
export function buildMemoryPromptSection(profileId) {
  const overlay = profileId ? PROFILE_MEMORY_OVERLAYS[profileId] : "";
  return overlay ? `${MEMORY_BEHAVIOR_CORE}\n\n${overlay}` : MEMORY_BEHAVIOR_CORE;
}

/**
 * Eval fixtures — brain over-save / under-recall scenarios.
 * @type {Array<{ id: string; message: string; expectRecall: boolean; expectSave: boolean }>}
 */
export const BRAIN_EVAL_SCENARIOS = [
  { id: "explicit_save_tr", message: "bunu hatırla: toplantı yarın 10:00", expectRecall: false, expectSave: true },
  { id: "explicit_recall_tr", message: "Gigi projesinde ne biliyorsun?", expectRecall: true, expectSave: false },
  { id: "chat_history_trap", message: "az önce söylediğim rakam neydi?", expectRecall: true, expectSave: false },
  { id: "no_implicit_save", message: "bugün hava güzel", expectRecall: false, expectSave: false },
];
