/**
 * Chat tool profiles — per-conversation behavior modes.
 * V8: each profile maps to a prompt mode + registry bundle.
 */

import { getEnvValue } from "../settings/effective-config.js";
import { DEFAULT_PROMPT_BUNDLE_ID, isChatMode } from "./prompt-constants.js";

export const CHAT_PROFILE_IDS = [
  "balanced",
  "answer_only",
  "research",
  "project_work",
  "code_editing",
  "automation",
  "personal_assistant",
  "safe",
  "telegram_assistant",
  "high_autonomy",
  "spec_planner",
  "desktop_assistant",
];

/** @type {Record<string, { label: string; description: string; allowWriteTools: boolean; toolIntents: string[]; maxIterations?: number; mode: string; promptBundleId: string }>} */
export const CHAT_PROFILES = {
  balanced: {
    label: "Dengeli",
    description: "Varsayılan — intent + router ile otomatik araç seçimi",
    allowWriteTools: true,
    toolIntents: ["general"],
    mode: "agent",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
  },
  answer_only: {
    label: "Sadece cevap",
    description: "Tool kullanmadan yanıtla",
    allowWriteTools: false,
    toolIntents: ["no_tool"],
    maxIterations: 1,
    mode: "chat",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
  },
  research: {
    label: "Araştırma",
    description: "Read-only araçlar, brain recall",
    allowWriteTools: false,
    toolIntents: ["brain_recall", "read_repo", "project_context", "external_api"],
    mode: "review",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
  },
  project_work: {
    label: "Proje işi",
    description: "Proje context + repo read",
    allowWriteTools: false,
    toolIntents: ["project_context", "read_repo", "brain_recall"],
    mode: "agent",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
  },
  code_editing: {
    label: "Kod düzenleme",
    description: "Repo read + dosya yazma + shell",
    allowWriteTools: true,
    toolIntents: ["read_repo", "modify_files", "run_command"],
    mode: "debug",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
  },
  automation: {
    label: "Otomasyon",
    description: "Hub workflow + n8n otomasyon",
    allowWriteTools: true,
    toolIntents: ["agent_workflow", "automation", "external_api"],
    mode: "ops",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
  },
  personal_assistant: {
    label: "Kişisel asistan",
    description: "Brain + harici API",
    allowWriteTools: true,
    toolIntents: ["brain_recall", "brain_save", "external_api"],
    mode: "agent",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
  },
  safe: {
    label: "Güvenli mod",
    description: "Sadece read + brain recall",
    allowWriteTools: false,
    toolIntents: ["no_tool", "brain_recall"],
    maxIterations: 3,
    mode: "chat",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
  },
  telegram_assistant: {
    label: "Telegram asistan",
    description: "Telegram — brain, Felix Desktop, Notion; onay ile write",
    allowWriteTools: true,
    toolIntents: [
      "desktop_local",
      "brain_recall",
      "project_context",
      "external_api",
      "agent_workflow",
      "automation",
    ],
    maxIterations: 8,
    mode: "agent",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
  },
  high_autonomy: {
    label: "Yüksek özerklik",
    description: "Tüm write araçları (onay politikası geçerli)",
    allowWriteTools: true,
    toolIntents: ["general"],
    maxIterations: 8,
    mode: "agent",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
  },
  spec_planner: {
    label: "Spec planlama",
    description: "requirements → design → tasks artifact üret",
    allowWriteTools: false,
    toolIntents: ["read_repo", "project_context", "brain_recall"],
    maxIterations: 4,
    mode: "spec",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
  },
  desktop_assistant: {
    label: "Felix Desktop",
    description: "Yerel dosya/terminal — onay ağırlıklı",
    allowWriteTools: true,
    toolIntents: ["desktop_local", "read_repo", "modify_files", "run_command"],
    maxIterations: 8,
    mode: "desktop",
    promptBundleId: DEFAULT_PROMPT_BUNDLE_ID,
  },
};

export function resolveChatProfile(profileId) {
  const id = profileId && CHAT_PROFILES[profileId] ? profileId : "balanced";
  return { id, ...CHAT_PROFILES[id] };
}

/**
 * Resolve prompt bundle + mode for registry render.
 * @param {{ chatProfile?: string; chatMode?: string | null; promptBundleId?: string | null }} [opts]
 */
export function resolvePromptRender(opts = {}) {
  const profile = resolveChatProfile(opts.chatProfile);
  const mode = isChatMode(opts.chatMode) ? opts.chatMode : profile.mode;
  const promptBundleId = opts.promptBundleId || profile.promptBundleId || DEFAULT_PROMPT_BUNDLE_ID;
  return { mode, promptBundleId, profileId: profile.id };
}

/**
 * Telegram webhook chat profile (env override).
 */
export function resolveTelegramChatProfile() {
  const raw = (getEnvValue("TELEGRAM_CHAT_PROFILE") || "telegram_assistant").trim();
  return CHAT_PROFILES[raw] ? raw : "telegram_assistant";
}

/**
 * Filter tools by profile allowed intents (union of intent tool maps).
 */
export function applyProfileToToolIntent(detectedIntent, profileId) {
  const profile = resolveChatProfile(profileId);
  if (profile.id === "balanced" || profile.toolIntents.includes("general")) {
    return detectedIntent;
  }
  if (profile.toolIntents.includes("no_tool")) return "no_tool";
  if (profile.toolIntents.includes(detectedIntent)) return detectedIntent;
  return profile.toolIntents[0] || detectedIntent;
}
