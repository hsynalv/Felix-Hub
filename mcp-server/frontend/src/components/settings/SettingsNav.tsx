import {
  Bot,
  Database,
  Laptop,
  Palette,
  Sparkles,
  Variable,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsSectionId =
  | "appearance"
  | "llm"
  | "integrations"
  | "connections"
  | "sidecar"
  | "advanced";

export const SETTINGS_SECTIONS: Array<{
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: "appearance",
    label: "Görünüm",
    description: "Tema ve arayüz",
    icon: Palette,
  },
  {
    id: "llm",
    label: "LLM",
    description: "Model ve sağlayıcı ataması",
    icon: Bot,
  },
  {
    id: "integrations",
    label: "Entegrasyonlar",
    description: "API anahtarları ve bağlantılar",
    icon: Variable,
  },
  {
    id: "connections",
    label: "Bağlantılar",
    description: "Harici servis profilleri",
    icon: Database,
  },
  {
    id: "sidecar",
    label: "Yerel erişim",
    description: "Sidecar ve bağlantı durumu",
    icon: Laptop,
  },
  {
    id: "advanced",
    label: "Gelişmiş",
    description: "Yedekleme ve bakım",
    icon: Sparkles,
  },
];

export function SettingsNav({
  active,
  onSelect,
}: {
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}) {
  return (
    <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto lg:w-52 lg:flex-col lg:gap-1">
      {SETTINGS_SECTIONS.map((s) => {
        const Icon = s.icon;
        const selected = active === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={cn(
              "flex min-w-[140px] items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all lg:min-w-0",
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
    </nav>
  );
}
