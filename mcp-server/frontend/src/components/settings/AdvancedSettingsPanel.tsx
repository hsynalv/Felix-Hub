import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileJson,
  KeyRound,
  LayoutTemplate,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/layout/StatusBadge";
import {
  SecretInput,
  SettingsInfoBox,
  SettingsSectionCard,
  SettingsStepList,
} from "@/components/settings/shared";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import {
  applySettingsTemplate,
  exportSettingsBundle,
  fetchSettings,
  fetchSettingsAudit,
  fetchSettingsDiff,
  fetchSettingsTemplates,
  importSettingsBundle,
  rotateMasterKey,
  validateSettingsKeys,
} from "@/lib/settings-api";
import { useToast } from "@/providers/ToastProvider";

type AdvancedFeatureId = "rotation" | "templates" | "export" | "diff" | "validate";

type AdvancedFeature = {
  id: AdvancedFeatureId;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  summary: string;
};

const FEATURES: AdvancedFeature[] = [
  {
    id: "rotation",
    label: "Şifreleme anahtarı",
    subtitle: "Güvenlik rotasyonu",
    icon: KeyRound,
    summary: "Kayıtlı gizli değerleri yeni bir anahtarla yeniden koruma altına alın",
  },
  {
    id: "templates",
    label: "Kurulum şablonları",
    subtitle: "Hızlı başlangıç",
    icon: LayoutTemplate,
    summary: "Yaygın kurulumlar için hazır yapılandırma iskeleti oluşturun",
  },
  {
    id: "export",
    label: "Dışa / içe aktar",
    subtitle: "Yedekleme",
    icon: Download,
    summary: "Tüm ayarları güvenli bir paket halinde yedekleyin veya geri yükleyin",
  },
  {
    id: "diff",
    label: "Kaynak karşılaştırma",
    subtitle: "Nereden geliyor?",
    icon: ArrowLeftRight,
    summary: "Aynı ayarın uygulama kaydı ile sistem yapılandırması arasındaki farkı görün",
  },
  {
    id: "validate",
    label: "Bağlantı testi",
    subtitle: "Canlı doğrulama",
    icon: ShieldCheck,
    summary: "Kritik entegrasyonların gerçekten çalıştığını kontrol edin",
  },
];

function FeatureNav({
  active,
  onSelect,
}: {
  active: AdvancedFeatureId;
  onSelect: (id: AdvancedFeatureId) => void;
}) {
  return (
    <div className="space-y-1.5">
      {FEATURES.map((f) => {
        const Icon = f.icon;
        const selected = active === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect(f.id)}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-all",
              selected
                ? "border-primary/40 bg-primary/10 shadow-sm shadow-primary/10"
                : "border-transparent bg-muted/20 hover:border-border hover:bg-muted/40"
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{f.label}</p>
              <p className="text-[11px] text-muted-foreground">{f.subtitle}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function RotationPanel() {
  const [rotateKey, setRotateKey] = useState("");
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: ({ key, dry }: { key: string; dry: boolean }) => rotateMasterKey(key, dry),
    onSuccess: (d) => {
      if (d.applied) toast.show(`Tamamlandı — ${d.rotated} kayıt güncellendi`);
      else if (d.dryRun) toast.show(`Önizleme: ${d.rotated} kayıt güncellenebilir`);
      else toast.show(`İşlem başarısız: ${d.failures.length} hata`, "error");
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "İşlem hatası", "error"),
  });

  return (
    <div className="space-y-5">
      <SettingsInfoBox variant="tip" title="Ne işe yarar?">
        Gizli ayarlarınızı koruyan şifreleme anahtarını değiştirdiğinizde, eski anahtarla kaydedilmiş
        değerler okunamaz hale gelir. Bu araç tüm kayıtları yeni anahtarla günceller.
      </SettingsInfoBox>

      <SettingsInfoBox variant="warning" title="Önemli">
        İşleme başlamadan önce <strong>Önizleme</strong> ile kaç kaydın etkileneceğini kontrol edin.
        Bu işlem geri alınamaz; yeni anahtarı güvenli bir yerde saklayın.
      </SettingsInfoBox>

      <SettingsStepList
        steps={[
          "Yeni şifreleme anahtarınızı hazırlayın",
          "Önizleme ile etkilenecek kayıt sayısını doğrulayın",
          "Anahtarı döndürün ve yeni anahtarı sunucu yapılandırmanıza ekleyin",
        ]}
      />

      <div className="space-y-2">
        <p className="text-sm font-medium">Yeni şifreleme anahtarı</p>
        <SecretInput value={rotateKey} onChange={setRotateKey} placeholder="Yeni anahtarınızı girin" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!rotateKey || mutation.isPending}
          onClick={() => mutation.mutate({ key: rotateKey, dry: true })}
        >
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Önizleme
        </Button>
        <Button disabled={!rotateKey || mutation.isPending} onClick={() => mutation.mutate({ key: rotateKey, dry: false })}>
          Anahtarı döndür
        </Button>
      </div>
    </div>
  );
}

function TemplatesPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["settings-templates"],
    queryFn: async () => (await fetchSettingsTemplates()).templates,
  });

  const mutation = useMutation({
    mutationFn: applySettingsTemplate,
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["settings-connections"] });
      queryClient.invalidateQueries({ queryKey: ["settings-env-catalog"] });
      toast.show(`Şablon uygulandı: ${d.templateId}`);
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Şablon hatası", "error"),
  });

  return (
    <div className="space-y-5">
      <SettingsInfoBox variant="tip" title="Ne işe yarar?">
        Yeni bir kurulumda sık kullanılan entegrasyonlar için boş yapılandırma alanları ve bağlantı
        profilleri oluşturur. Değerleri daha sonra Entegrasyonlar bölümünden doldurursunuz.
      </SettingsInfoBox>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {templates?.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileJson className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.settingsCount ?? "—"} ayar · {t.profilesCount ?? "—"} bağlantı profili
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(t.id)}
              >
                {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Uygula
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExportImportPanel() {
  const [importBlob, setImportBlob] = useState("");
  const toast = useToast();
  const queryClient = useQueryClient();

  const exportMutation = useMutation({
    mutationFn: exportSettingsBundle,
    onSuccess: (d) => {
      navigator.clipboard?.writeText(d.encrypted);
      toast.show(`Panoya kopyalandı — ${d.meta.settings} ayar, ${d.meta.profiles} profil`);
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Dışa aktarma hatası", "error"),
  });

  const importMutation = useMutation({
    mutationFn: ({ blob, dry }: { blob: string; dry: boolean }) => importSettingsBundle(blob, dry),
    onSuccess: (d) => {
      if (!d.dryRun) {
        queryClient.invalidateQueries({ queryKey: ["settings"] });
        queryClient.invalidateQueries({ queryKey: ["settings-env-catalog"] });
      }
      toast.show(d.dryRun ? `Önizleme: ${d.importedSettings} ayar aktarılabilir` : "İçe aktarma tamamlandı");
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "İçe aktarma hatası", "error"),
  });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <SettingsInfoBox variant="tip" title="Dışa aktarma">
          Tüm gizli ayarlarınızı ve bağlantı profillerinizi tek bir güvenli pakette yedekler.
          Sunucu taşıma, ortam kopyalama veya felaket kurtarma senaryolarında kullanın.
        </SettingsInfoBox>

        <Button disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
          {exportMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ClipboardCopy className="mr-2 h-4 w-4" />
          )}
          Yedek oluştur ve panoya kopyala
        </Button>
      </div>

      <div className="space-y-4 border-t border-border pt-6">
        <SettingsInfoBox variant="tip" title="İçe aktarma">
          Daha önce oluşturduğunuz yedek paketini bu sunucuya geri yükler. Kaynak ve hedef sunucunun
          aynı şifreleme anahtarını kullanması gerekir. Önce önizleme ile kontrol edin.
        </SettingsInfoBox>

        <Textarea
          rows={5}
          className="font-mono text-xs"
          value={importBlob}
          onChange={(e) => setImportBlob(e.target.value)}
          placeholder="Yedek paketini buraya yapıştırın…"
        />

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!importBlob.trim() || importMutation.isPending}
            onClick={() => importMutation.mutate({ blob: importBlob, dry: true })}
          >
            <Upload className="mr-2 h-4 w-4" />
            Önizleme
          </Button>
          <Button
            disabled={!importBlob.trim() || importMutation.isPending}
            onClick={() => importMutation.mutate({ blob: importBlob, dry: false })}
          >
            İçe aktar
          </Button>
        </div>
      </div>
    </div>
  );
}

function DiffPanel() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["settings-diff"],
    queryFn: fetchSettingsDiff,
  });

  return (
    <div className="space-y-5">
      <SettingsInfoBox variant="tip" title="Ne işe yarar?">
        Bir ayarın nereden okunduğunu anlamanıza yardımcı olur. Uygulama üzerinden kaydettiğiniz
        değerler ile sunucu yapılandırmasındaki değerler farklı olabilir; çakışma durumunda uygulama
        kaydı geçerli olur.
      </SettingsInfoBox>

      <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
        {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowLeftRight className="mr-2 h-4 w-4" />}
        Karşılaştırmayı yenile
      </Button>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        </div>
      ) : data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <DiffColumn
            title="Yalnızca uygulamada"
            description="Bu arayüzden kaydedilmiş değerler"
            items={data.overlayOnly}
            empty="Kayıtlı özel ayar yok"
          />
          <DiffColumn
            title="Yalnızca sistemde"
            description="Sunucu yapılandırmasında tanımlı değerler"
            items={data.envOnly}
            empty="Ek sistem ayarı yok"
          />
          {data.conflicts.length > 0 && (
            <div className="lg:col-span-2">
              <DiffColumn
                title="Her iki kaynakta da var"
                description="Çakışma durumunda uygulama kaydı kullanılır"
                items={data.conflicts.map((c) => ({ key: c.key, masked: c.masked }))}
                empty=""
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DiffColumn({
  title,
  description,
  items,
  empty,
}: {
  title: string;
  description: string;
  items: Array<{ key: string; masked: string | null }>;
  empty: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/10">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        <Badge className="mt-2 text-[10px]">{items.length} anahtar</Badge>
      </div>
      <ul className="max-h-56 overflow-auto p-2">
        {items.length === 0 ? (
          <li className="px-2 py-4 text-center text-xs text-muted-foreground">{empty}</li>
        ) : (
          items.map((r) => (
            <li
              key={r.key}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50"
            >
              <code className="font-semibold">{r.key}</code>
              <span className="truncate font-mono text-muted-foreground">{r.masked ?? "—"}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function ValidatePanel() {
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: () => validateSettingsKeys(["REDIS_URL", "HUB_MSSQL_URL", "OPENAI_API_KEY"]),
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Test hatası", "error"),
  });

  const VALIDATOR_LABELS: Record<string, { title: string; description: string }> = {
    REDIS_URL: {
      title: "Önbellek ve arka plan işleri",
      description: "Arka plan görevleri ve geçici veri depolama bağlantısı",
    },
    HUB_MSSQL_URL: {
      title: "Ana veritabanı",
      description: "Sohbet geçmişi ve ayarların saklandığı veritabanı",
    },
    OPENAI_API_KEY: {
      title: "OpenAI",
      description: "Yapay zeka modeli API erişimi",
    },
  };

  return (
    <div className="space-y-5">
      <SettingsInfoBox variant="tip" title="Ne işe yarar?">
        Kritik entegrasyonların gerçekten çalışıp çalışmadığını kontrol eder. Hiçbir ayarı
        değiştirmez; yalnızca mevcut yapılandırmanızı test eder.
      </SettingsInfoBox>

      <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="mr-2 h-4 w-4" />
        )}
        Bağlantıları test et
      </Button>

      {mutation.data && (
        <div className="space-y-2">
          {Object.entries(mutation.data).map(([k, v]) => {
            const info = VALIDATOR_LABELS[k];
            return (
            <div
              key={k}
              className="flex flex-col gap-1 rounded-xl border border-border bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium">{info?.title ?? k}</p>
                <p className="text-xs text-muted-foreground">{info?.description ?? "Bağlantı testi"}</p>
              </div>
              <StatusBadge
                status={v.ok ? "ok" : v.skipped ? "disabled" : "error"}
                label={v.ok ? "çalışıyor" : v.skipped ? "atlandı" : "başarısız"}
              />
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const PANELS: Record<AdvancedFeatureId, () => ReactNode> = {
  rotation: RotationPanel,
  templates: TemplatesPanel,
  export: ExportImportPanel,
  diff: DiffPanel,
  validate: ValidatePanel,
};

function SettingsAuditPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["settings-audit"],
    queryFn: () => fetchSettingsAudit(30),
    retry: false,
  });
  const entries = data?.entries ?? [];

  return (
    <SettingsSectionCard
      icon={ShieldCheck}
      title="Secret değişiklik günlüğü"
      description="Anahtar güncellemeleri — değerler asla kaydedilmez."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz kayıt yok veya depolama kapalı.</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {entries.map((e) => (
            <li key={e.id} className="rounded-lg border border-border/50 px-3 py-2">
              <span className="font-mono text-primary">{e.keyName}</span> — {e.action}
              <span className="ml-2 text-muted-foreground">{e.actorId || "system"}</span>
            </li>
          ))}
        </ul>
      )}
    </SettingsSectionCard>
  );
}

export function AdvancedSettingsPanel() {
  const [active, setActive] = useState<AdvancedFeatureId>("rotation");
  const feature = FEATURES.find((f) => f.id === active)!;
  const Panel = PANELS[active];

  const { data: meta } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    retry: false,
  });

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-5 sm:p-6">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Gelişmiş</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Yedekleme, taşıma, kurulum şablonları ve bağlantı doğrulama araçları. Bu bölümdeki
              işlemler yönetici yetkisi gerektirir.
            </p>
            {meta && (
              <div className="flex flex-wrap gap-2 pt-2">
                <StatusBadge
                  status={meta.persistenceHealthy ? "healthy" : "degraded"}
                  label={`Depolama: ${meta.persistenceHealthy ? "aktif" : "sorunlu"}`}
                />
                <StatusBadge
                  status={meta.masterKeyConfigured ? "ok" : "warning"}
                  label={`Güvenlik: ${meta.masterKeyConfigured ? "hazır" : "eksik"}`}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <FeatureNav active={active} onSelect={setActive} />

        <SettingsSectionCard
          icon={feature.icon}
          title={feature.label}
          description={feature.summary}
          accent
        >
          <Panel />
        </SettingsSectionCard>
      </div>

      <SettingsAuditPanel />
    </div>
  );
}
