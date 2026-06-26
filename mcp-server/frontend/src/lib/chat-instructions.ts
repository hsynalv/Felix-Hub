export type ResponseStyle = "concise" | "detailed";

export type ChatProfileId =
  | "balanced"
  | "answer_only"
  | "research"
  | "project_work"
  | "code_editing"
  | "automation"
  | "personal_assistant"
  | "safe"
  | "high_autonomy";

export interface ConversationSettings {
  instructions?: string;
  includeBrainContext?: boolean;
  responseStyle?: ResponseStyle;
  presetId?: string;
  chatProfile?: ChatProfileId;
}

export const CHAT_PROFILE_OPTIONS: Array<{ id: ChatProfileId; label: string; description: string }> = [
  { id: "balanced", label: "Dengeli", description: "Varsayılan otomatik araç seçimi" },
  { id: "answer_only", label: "Sadece cevap", description: "Tool kullanmadan yanıt" },
  { id: "research", label: "Araştırma", description: "Read-only + brain recall" },
  { id: "project_work", label: "Proje işi", description: "Proje context öncelikli" },
  { id: "code_editing", label: "Kod düzenleme", description: "Repo read + yazma" },
  { id: "automation", label: "Otomasyon", description: "Workflow araçları" },
  { id: "personal_assistant", label: "Kişisel asistan", description: "Brain + harici API" },
  { id: "safe", label: "Güvenli mod", description: "Sadece read + recall" },
  { id: "high_autonomy", label: "Yüksek özerklik", description: "Tüm write araçları" },
];

export const INSTRUCTION_PRESETS: Array<{
  id: string;
  label: string;
  instructions: string;
}> = [
  { id: "general", label: "Genel asistan", instructions: "" },
  {
    id: "code-review",
    label: "Kod incelemecisi",
    instructions:
      "Sen kıdemli bir kod incelemecisisin. Güvenlik, performans ve okunabilirlik odaklı geri bildirim ver. Somut öneriler sun.",
  },
  {
    id: "devops",
    label: "DevOps / SRE",
    instructions:
      "Sen kıdemli bir DevOps/SRE mühendisisin. Altyapı, CI/CD, gözlemlenebilirlik ve güvenilirlik konularında Türkçe yanıt ver.",
  },
  {
    id: "tech-writer",
    label: "Teknik yazar",
    instructions:
      "Sen deneyimli bir teknik yazarsın. Karmaşık konuları net, yapılandırılmış ve örneklerle açıkla.",
  },
  {
    id: "debugging",
    label: "Hata ayıklama",
    instructions:
      "Sen sistematik bir hata ayıklama uzmanısın. Sorunu adım adım analiz et, olası kök nedenleri sırala ve uygulanabilir çözümler öner.",
  },
];

export const MAX_INSTRUCTIONS_LENGTH = 4000;

export const DEFAULT_CONVERSATION_SETTINGS: ConversationSettings = {
  instructions: "",
  includeBrainContext: true,
  responseStyle: "concise",
  presetId: "general",
  chatProfile: "balanced",
};

export function parseConversationSettings(
  metadata?: Record<string, unknown> | null
): ConversationSettings {
  if (!metadata || typeof metadata !== "object") {
    return { ...DEFAULT_CONVERSATION_SETTINGS };
  }
  return {
    instructions:
      typeof metadata.instructions === "string" ? metadata.instructions : "",
    includeBrainContext:
      typeof metadata.includeBrainContext === "boolean"
        ? metadata.includeBrainContext
        : true,
    responseStyle:
      metadata.responseStyle === "detailed" ? "detailed" : "concise",
    presetId:
      typeof metadata.presetId === "string" ? metadata.presetId : "general",
    chatProfile:
      typeof metadata.chatProfile === "string" &&
      CHAT_PROFILE_OPTIONS.some((p) => p.id === metadata.chatProfile)
        ? (metadata.chatProfile as ChatProfileId)
        : "balanced",
  };
}

export function hasActiveInstructions(settings: ConversationSettings): boolean {
  return Boolean(settings.instructions?.trim());
}

export function buildSystemPromptFromSettings(settings: ConversationSettings): string | undefined {
  const instructions = settings.instructions?.trim();
  if (!instructions) return undefined;
  return instructions.slice(0, MAX_INSTRUCTIONS_LENGTH);
}
