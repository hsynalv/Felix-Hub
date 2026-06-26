/**
 * Chat tool profiles — per-conversation behavior modes.
 */

import { getEnvValue } from "../settings/effective-config.js";

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
];

/** @type {Record<string, { label: string; description: string; allowWriteTools: boolean; toolIntents: string[]; maxIterations?: number }>} */
export const CHAT_PROFILES = {
  balanced: {
    label: "Dengeli",
    description: "Varsayılan — intent + router ile otomatik araç seçimi",
    allowWriteTools: true,
    toolIntents: ["general"],
  },
  answer_only: {
    label: "Sadece cevap",
    description: "Tool kullanmadan yanıtla",
    allowWriteTools: false,
    toolIntents: ["no_tool"],
    maxIterations: 1,
  },
  research: {
    label: "Araştırma",
    description: "Read-only araçlar, brain recall",
    allowWriteTools: false,
    toolIntents: ["brain_recall", "read_repo", "project_context", "external_api"],
  },
  project_work: {
    label: "Proje işi",
    description: "Proje context + repo read",
    allowWriteTools: false,
    toolIntents: ["project_context", "read_repo", "brain_recall"],
  },
  code_editing: {
    label: "Kod düzenleme",
    description: "Repo read + dosya yazma + shell",
    allowWriteTools: true,
    toolIntents: ["read_repo", "modify_files", "run_command"],
  },
  automation: {
    label: "Otomasyon",
    description: "Hub workflow + n8n otomasyon",
    allowWriteTools: true,
    toolIntents: ["agent_workflow", "automation", "external_api"],
  },
  personal_assistant: {
    label: "Kişisel asistan",
    description: "Brain + harici API",
    allowWriteTools: true,
    toolIntents: ["brain_recall", "brain_save", "external_api"],
  },
  safe: {
    label: "Güvenli mod",
    description: "Sadece read + brain recall",
    allowWriteTools: false,
    toolIntents: ["no_tool", "brain_recall"],
    maxIterations: 3,
  },
  telegram_assistant: {
    label: "Telegram asistan",
    description: "Telegram kanalı — araştırma, Notion, brain; sınırlı write (policy)",
    allowWriteTools: true,
    toolIntents: ["brain_recall", "project_context", "external_api", "agent_workflow", "automation"],
    maxIterations: 6,
  },
  high_autonomy: {
    label: "Yüksek özerklik",
    description: "Tüm write araçları (onay politikası geçerli)",
    allowWriteTools: true,
    toolIntents: ["general"],
    maxIterations: 8,
  },
};

export function resolveChatProfile(profileId) {
  const id = profileId && CHAT_PROFILES[profileId] ? profileId : "balanced";
  return { id, ...CHAT_PROFILES[id] };
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
