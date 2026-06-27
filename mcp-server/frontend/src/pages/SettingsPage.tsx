import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdvancedSettingsPanel } from "@/components/settings/AdvancedSettingsPanel";
import { AppearanceSettingsPanel } from "@/components/settings/AppearanceSettingsPanel";
import { ConnectionsSettingsPanel } from "@/components/settings/ConnectionsSettingsPanel";
import { PluginEnvPanel } from "@/components/settings/PluginEnvPanel";
import { LlmRoutingPanel } from "@/components/settings/LlmRoutingPanel";
import { PersonalOsSettingsPanel } from "@/components/settings/PersonalOsSettingsPanel";
import { SidecarSettingsPanel } from "@/components/settings/SidecarSettingsPanel";
import { SettingsNav, type SettingsSectionId } from "@/components/settings/SettingsNav";
import { fetchSettings } from "@/lib/settings-api";
import { ApiError } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";

const SECTION_HEADERS: Record<SettingsSectionId, { title: string; description: string }> = {
  appearance: {
    title: "Görünüm",
    description: "Arayüzün nasıl görüneceğini kişiselleştirin.",
  },
  llm: {
    title: "LLM",
    description: "Tek anahtar veya sohbet / router için ayrı sağlayıcı ataması.",
  },
  integrations: {
    title: "Entegrasyonlar",
    description: "Eklentilerin ihtiyaç duyduğu API anahtarlarını ve bağlantı bilgilerini yönetin.",
  },
  personal: {
    title: "Kişisel OS",
    description: "Günlük brifing kaynakları (RSS, IMAP) ve Telegram giden mesaj geçmişi.",
  },
  connections: {
    title: "Bağlantılar",
    description: "Harici servislere ait kayıtlı bağlantı profillerini görüntüleyin.",
  },
  sidecar: {
    title: "Felix Desktop",
    description: "Yerel masaüstü ajanı, production modu ve eşleştirilmiş cihazlar.",
  },
  advanced: {
    title: "Gelişmiş",
    description: "Yedekleme, taşıma ve kurulum araçları.",
  },
};

export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialSection: SettingsSectionId =
    tabParam === "personal" ||
    tabParam === "appearance" ||
    tabParam === "llm" ||
    tabParam === "integrations" ||
    tabParam === "connections" ||
    tabParam === "sidecar" ||
    tabParam === "advanced"
      ? tabParam
      : "integrations";
  const [section, setSection] = useState<SettingsSectionId>(initialSection);

  useEffect(() => {
    if (tabParam && tabParam !== section) {
      const next = tabParam as SettingsSectionId;
      if (
        ["appearance", "llm", "integrations", "personal", "connections", "sidecar", "advanced"].includes(next)
      ) {
        setSection(next);
      }
    }
  }, [tabParam, section]);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    retry: false,
  });

  const isForbidden = settingsQuery.error instanceof ApiError && settingsQuery.error.status === 403;
  const needsAdmin =
    section !== "appearance" && section !== "sidecar" && section !== "personal";
  const header = SECTION_HEADERS[section];

  return (
    <div className="mx-auto flex min-w-0 max-w-6xl flex-col gap-4 sm:gap-6 lg:flex-row lg:items-start">
      <SettingsNav active={section} onSelect={setSection} />

      <div className="min-w-0 flex-1 space-y-5">
        {section !== "advanced" && (
          <PageHeader title={header.title} description={header.description} />
        )}

        {section === "appearance" && <AppearanceSettingsPanel />}

        {isForbidden && needsAdmin && (
          <Card className="border-amber-500/40">
            <CardContent className="flex items-start gap-3 pt-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-amber-100">
                Bu bölüme erişim için yönetici yetkisi gerekir. Yetkiniz yoksa sistem yöneticinize
                başvurun.
              </p>
            </CardContent>
          </Card>
        )}

        {section === "integrations" && !isForbidden && <PluginEnvPanel />}
        {section === "personal" && <PersonalOsSettingsPanel />}
        {section === "llm" && !isForbidden && <LlmRoutingPanel />}
        {section === "connections" && !isForbidden && <ConnectionsSettingsPanel />}
        {section === "sidecar" && <SidecarSettingsPanel />}
        {section === "advanced" && !isForbidden && <AdvancedSettingsPanel />}
      </div>
    </div>
  );
}
