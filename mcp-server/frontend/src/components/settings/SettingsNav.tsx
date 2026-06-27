import {
  Bot,
  Database,
  FileCode2,
  Flower2,
  KeyRound,
  Laptop,
  Palette,
  Sparkles,
  Variable,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsSectionId =
  | "account"
  | "appearance"
  | "llm"
  | "integrations"
  | "personal"
  | "connections"
  | "sidecar"
  | "prompts"
  | "advanced";

export type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "hesap" | "kisisel" | "hub" | "sistem";
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "account",
    label: "Hesabım",
    description: "Ad, e-posta ve şifre",
    icon: KeyRound,
    group: "hesap",
  },
  {
    id: "appearance",
    label: "Görünüm",
    description: "Tema ve arayüz",
    icon: Palette,
    group: "kisisel",
  },
  {
    id: "personal",
    label: "Kişisel OS",
    description: "Brifing, Telegram, Gmail",
    icon: Flower2,
    group: "kisisel",
  },
  {
    id: "llm",
    label: "LLM",
    description: "Model ve sağlayıcı",
    icon: Bot,
    group: "hub",
  },
  {
    id: "integrations",
    label: "Entegrasyonlar",
    description: "API anahtarları",
    icon: Variable,
    group: "hub",
  },
  {
    id: "connections",
    label: "Bağlantılar",
    description: "Harici servis profilleri",
    icon: Database,
    group: "hub",
  },
  {
    id: "sidecar",
    label: "Felix Desktop",
    description: "Yerel masaüstü ajanı",
    icon: Laptop,
    group: "hub",
  },
  {
    id: "prompts",
    label: "Prompt Registry",
    description: "Import draft onay kuyruğu",
    icon: FileCode2,
    group: "sistem",
  },
  {
    id: "advanced",
    label: "Gelişmiş",
    description: "Yedekleme ve bakım",
    icon: Sparkles,
    group: "sistem",
  },
];

const GROUP_LABELS: Record<SettingsSection["group"], string> = {
  hesap: "Hesap",
  kisisel: "Kişisel",
  hub: "Hub yapılandırması",
  sistem: "Sistem",
};

export function SettingsNav({
  active,
  onSelect,
}: {
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}) {
  const groups = ["hesap", "kisisel", "hub", "sistem"] as const;

  return (
    <nav className="scrollbar-chip-row flex w-full shrink-0 flex-col gap-4 lg:w-56">
      <div className="-mx-1 flex flex-row gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-4 lg:overflow-visible lg:pb-0">
        {groups.map((group) => {
          const items = SETTINGS_SECTIONS.filter((s) => s.group === group);
          return (
            <div key={group} className="min-w-[148px] shrink-0 lg:min-w-0">
              <p className="mb-1.5 hidden px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:block">
                {GROUP_LABELS[group]}
              </p>
              <div className="flex flex-row gap-1 lg:flex-col lg:gap-0.5">
                {items.map((s) => {
                  const Icon = s.icon;
                  const selected = active === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelect(s.id)}
                      className={cn(
                        "flex min-w-[140px] items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all lg:min-w-0 lg:w-full",
                        selected
                          ? "bg-primary/15 text-primary shadow-sm shadow-primary/5"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", selected && "text-primary")} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">{s.label}</p>
                        <p className="hidden text-[11px] opacity-80 lg:block">{s.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
