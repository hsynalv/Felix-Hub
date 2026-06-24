export type ResponseStyle = "concise" | "detailed";

export interface ConversationSettings {
  instructions?: string;
  includeBrainContext?: boolean;
  responseStyle?: ResponseStyle;
  presetId?: string;
}

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
