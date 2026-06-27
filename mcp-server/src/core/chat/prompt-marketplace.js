/**
 * V8 Faz C — prompt marketplace catalog (behavior packs).
 */

import { DEFAULT_PROMPT_BUNDLE_ID } from "../chat/prompt-constants.js";

/** Derived section overlays — Felix-authored, not verbatim vendor dumps. */
export const MARKETPLACE_SECTION_OVERLAYS = {
  "felix-coder-cursor": {
    code_style: `## Focused coding discipline (derived)
- Prefer minimal diffs; avoid drive-by refactors.
- Read files before editing; cite paths in feedback.
- Do not name internal tool names to the user — describe actions plainly.`,
    tool_calling: `## Focused coding tool flow (derived)
- Gather context with read/search tools before write.
- One focused change set per turn when possible.`,
  },
  "felix-spec-kiro": {
    completion_spec: `## Spec planner flow (derived)
- Clarify scope before large specs.
- Produce requirements → design → tasks in order.
- Keep artifacts markdown-ready for export.`,
  },
  "felix-telegram": {
    response_style: `## Telegram Felix (derived)
- Short paragraphs; lead with the answer.
- Include links/ids when tools return them.`,
  },
};

/**
 * @type {Array<{ id: string; label: string; description: string; chatProfile: string; chatMode: string; promptBundleId: string; tags: string[] }>}
 */
export const PROMPT_MARKETPLACE_CATALOG = [
  {
    id: "felix-default",
    label: "Felix Default",
    description: "Dengeli agent — varsayılan Felix davranışı",
    chatProfile: "balanced",
    chatMode: "agent",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
    tags: ["marketplace", "felix"],
  },
  {
    id: "felix-spec-kiro",
    label: "Spec Planner",
    description: "Spec planlama — requirements / design / tasks",
    chatProfile: "spec_planner",
    chatMode: "spec",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
    tags: ["marketplace", "spec"],
  },
  {
    id: "felix-coder-cursor",
    label: "Focused Coder",
    description: "Kod odaklı agent + inceleme disiplini",
    chatProfile: "code_editing",
    chatMode: "agent",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
    tags: ["marketplace", "coding"],
  },
  {
    id: "felix-ops-v5",
    label: "Ops / Runbook",
    description: "Workflow, incident, release odaklı",
    chatProfile: "automation",
    chatMode: "ops",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
    tags: ["marketplace", "ops"],
  },
  {
    id: "felix-telegram",
    label: "Telegram Felix",
    description: "Kısa yanıt, tool disiplini",
    chatProfile: "telegram_assistant",
    chatMode: "agent",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
    tags: ["marketplace", "telegram"],
  },
  {
    id: "felix-desktop",
    label: "Felix Desktop",
    description: "Yerel dosya/terminal — onay ağırlıklı",
    chatProfile: "desktop_assistant",
    chatMode: "desktop",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
    tags: ["marketplace", "desktop"],
  },
];

/**
 * @param {string} packId
 */
export function resolveMarketplacePack(packId) {
  const pack = PROMPT_MARKETPLACE_CATALOG.find((p) => p.id === packId);
  if (!pack) return null;
  return {
    ...pack,
    sectionOverlay: MARKETPLACE_SECTION_OVERLAYS[packId] || null,
  };
}

export function listMarketplacePacks() {
  return PROMPT_MARKETPLACE_CATALOG.map(({ id, label, description, chatProfile, chatMode, tags }) => ({
    id,
    label,
    description,
    chatProfile,
    chatMode,
    tags,
  }));
}
