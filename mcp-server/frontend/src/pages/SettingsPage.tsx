import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_SHELL_SETTINGS } from "@/components/layout/page-layout";
import { AccountSettingsPanel } from "@/components/settings/AccountSettingsPanel";
import { AdvancedSettingsPanel } from "@/components/settings/AdvancedSettingsPanel";
import { AppearanceSettingsPanel } from "@/components/settings/AppearanceSettingsPanel";
import { ConnectionsSettingsPanel } from "@/components/settings/ConnectionsSettingsPanel";
import { PluginEnvPanel } from "@/components/settings/PluginEnvPanel";
import { LlmRoutingPanel } from "@/components/settings/LlmRoutingPanel";
import { PersonalOsSettingsPanel } from "@/components/settings/PersonalOsSettingsPanel";
import { PromptImportSettingsPanel } from "@/components/settings/PromptImportSettingsPanel";
import {
  SettingsNav,
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "@/components/settings/SettingsNav";
import { fetchSettings } from "@/lib/settings-api";
import { ApiError } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const VALID_TABS = new Set(SETTINGS_SECTIONS.map((s) => s.id));

const SECTION_HEADERS: Record<SettingsSectionId, { title: string; description: string }> = {
  account: {
    title: "Hesabım",
    description: "Profil bilgileriniz ve şifre yönetimi.",
  },
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
    description: "Günlük brifing kaynakları, zamanlama ve Telegram.",
  },
  connections: {
    title: "Bağlantılar",
    description: "Harici servislere ait kayıtlı bağlantı profillerini görüntüleyin.",
  },
  prompts: {
    title: "Prompt Registry",
    description: "Harici arşivden türetilmiş draft'ları inceleyin ve onaylayın.",
  },
  advanced: {
    title: "Gelişmiş",
    description: "Yedekleme, taşıma ve kurulum araçları.",
  },
};

function parseTabParam(tab: string | null): SettingsSectionId | "sidecar" {
  if (tab === "sidecar") return "sidecar";
  if (tab && VALID_TABS.has(tab as SettingsSectionId)) {
    return tab as SettingsSectionId;
  }
  return "integrations";
}

export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tabParam = searchParams.get("tab");
  const parsed = parseTabParam(tabParam);

  if (parsed === "sidecar") {
    return <Navigate to="/desktop" replace />;
  }

  const [section, setSection] = useState<SettingsSectionId>(() => parsed as SettingsSectionId);

  useEffect(() => {
    const next = parseTabParam(tabParam);
    if (next === "sidecar") return;
    if (next !== section) setSection(next);
  }, [tabParam, section]);

  const selectSection = (id: SettingsSectionId) => {
    setSection(id);
    navigate(id === "integrations" ? "/settings" : `/settings?tab=${id}`, { replace: true });
  };

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    retry: false,
  });

  const isForbidden = settingsQuery.error instanceof ApiError && settingsQuery.error.status === 403;
  const needsAdmin =
    section !== "appearance" &&
    section !== "personal" &&
    section !== "account";
  const header = SECTION_HEADERS[section];

  return (
    <div className={cn(PAGE_SHELL_SETTINGS, "flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-start")}>
      <SettingsNav active={section} onSelect={selectSection} />

      <div className="flex min-w-0 flex-1 flex-col lg:min-w-[min(100%,42rem)]">
        <div className="min-h-[min(70vh,720px)] rounded-2xl border border-border/80 bg-card/40 p-4 shadow-sm backdrop-blur-sm sm:p-6">
          {section !== "advanced" && (
            <PageHeader title={header.title} description={header.description} className="mb-5" />
          )}

          {section === "account" && <AccountSettingsPanel />}
          {section === "appearance" && <AppearanceSettingsPanel />}

          {isForbidden && needsAdmin && (
            <Card className="border-amber-500/40">
              <CardContent className="flex items-start gap-3 pt-4 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-amber-100">
                  Bu bölüme erişim için yönetici yetkisi gerekir. Yetkiniz yoksa sistem yöneticinize başvurun.
                </p>
              </CardContent>
            </Card>
          )}

          {section === "integrations" && !isForbidden && <PluginEnvPanel />}
          {section === "personal" && <PersonalOsSettingsPanel />}
          {section === "llm" && !isForbidden && <LlmRoutingPanel />}
          {section === "connections" && !isForbidden && <ConnectionsSettingsPanel />}
          {section === "prompts" && !isForbidden && <PromptImportSettingsPanel />}
          {section === "advanced" && !isForbidden && <AdvancedSettingsPanel />}
        </div>
      </div>
    </div>
  );
}
