import { Database, Loader2, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/EmptyState";
import { SettingsInfoBox, SettingsSectionCard } from "@/components/settings/shared";
import { ApiError } from "@/lib/api-client";
import { fetchConnectionProfiles, saveConnectionProfile } from "@/lib/settings-api";
import { useToast } from "@/providers/ToastProvider";

const PROFILE_LABELS: Record<string, string> = {
  redis: "Önbellek ve arka plan işleri",
  mssql: "Ana veritabanı",
  openai: "Yapay zeka modeli",
  notion: "Notion workspace",
  postgres: "PostgreSQL",
  mongodb: "MongoDB",
};

export function ConnectionsSettingsPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["settings-connections"],
    queryFn: fetchConnectionProfiles,
    retry: false,
  });

  const profileMutation = useMutation({
    mutationFn: saveConnectionProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-connections"] });
      toast.show("Bağlantı profili kaydedildi");
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Profil hatası", "error"),
  });

  const profiles = data?.profiles ?? [];

  return (
    <SettingsSectionCard
      icon={Database}
      title="Bağlantı profilleri"
      description="Tekrar kullanılabilir servis bağlantıları. Entegrasyon anahtarlarından ayrı, yapılandırılmış bağlantı bilgilerini saklar."
    >
      <div className="space-y-4">
        <SettingsInfoBox variant="tip" title="Ne işe yarar?">
          Aynı servise birden fazla bağlantı tanımlayabilirsiniz. Varsayılan olarak işaretlenen profil,
          ilgili eklenti o servisi kullanırken öncelikli seçilir. Kurulum şablonu uyguladığınızda
          profiller otomatik oluşturulabilir.
        </SettingsInfoBox>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Yükleniyor…
          </div>
        ) : profiles.length === 0 ? (
          <EmptyState
            icon={Database}
            title="Henüz bağlantı profili yok"
            description="Gelişmiş bölümünden bir kurulum şablonu uygulayarak başlayabilirsiniz."
            action={
              <Button
                variant="outline"
                size="sm"
                disabled={profileMutation.isPending}
                onClick={() =>
                  profileMutation.mutate({
                    profileName: `cache-${Date.now()}`,
                    profileType: "redis",
                    config: { url: "redis://localhost:6379" },
                    isDefault: true,
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Örnek profil ekle
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {profiles.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-border bg-muted/10 px-4 py-3 transition-colors hover:border-primary/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.profileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {PROFILE_LABELS[p.profileType] ?? p.profileType}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {p.isDefault && <Badge variant="success">varsayılan</Badge>}
                    {!p.isActive && <Badge variant="warning">pasif</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsSectionCard>
  );
}
