import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SettingsSectionCard } from "@/components/settings/shared";
import { useTheme } from "@/providers/ThemeProvider";

export function AppearanceSettingsPanel() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <SettingsSectionCard
      icon={isDark ? Moon : Sun}
      title="Görünüm"
      description="Tema tercihiniz yalnızca bu tarayıcıda saklanır; diğer cihazlardan bağımsızdır."
    >
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
        <div>
          <p className="text-sm font-medium">{isDark ? "Koyu mod" : "Açık mod"}</p>
          <p className="text-xs text-muted-foreground">
            {isDark ? "Göz yormayan koyu arayüz" : "Aydınlık ortamlar için açık arayüz"}
          </p>
        </div>
        <Switch checked={isDark} onCheckedChange={() => toggle()} />
      </div>
    </SettingsSectionCard>
  );
}
