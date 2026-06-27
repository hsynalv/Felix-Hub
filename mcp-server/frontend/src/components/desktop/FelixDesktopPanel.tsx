import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Copy,
  Laptop,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { SettingsInfoBox, SettingsSectionCard } from "@/components/settings/shared";
import { FelixDesktopChecklist } from "@/components/desktop/FelixDesktopConnectionGuide";
import { ApiError, apiGet, type WhoamiData } from "@/lib/api-client";
import {
  createSidecarPairingCode,
  fetchSidecarStatus,
  pairSidecarDevice,
  removeSidecarDevice,
  sidecarModeDescription,
  sidecarStatusLabel,
  sidecarStatusTone,
  type SidecarDevice,
} from "@/lib/sidecar-api";
import { BRAND } from "@/lib/branding";
import { useToast } from "@/providers/ToastProvider";
import { cn, formatTime } from "@/lib/utils";

function DeviceRow({
  device,
  onRemove,
  removing,
  canRemove,
}: {
  device: SidecarDevice;
  onRemove: () => void;
  removing: boolean;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-muted/10 px-4 py-3.5 transition-colors hover:bg-muted/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{device.name}</p>
            <StatusBadge
              status={device.online ? "healthy" : "error"}
              label={device.online ? "Çevrimiçi" : "Çevrimdışı"}
              className="text-[10px]"
            />
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">{device.baseUrl}</p>
          <div className="flex flex-wrap gap-1.5">
            {(device.capabilities ?? ["fs"]).map((cap) => (
              <Badge key={cap} variant="default" className="text-[10px] font-normal">
                {cap}
              </Badge>
            ))}
          </div>
          {device.pairedAt && (
            <p className="text-[11px] text-muted-foreground">
              Eşleştirildi: {formatTime(device.pairedAt)}
              {device.lastSeenAt ? ` · Son: ${formatTime(device.lastSeenAt)}` : ""}
            </p>
          )}
          {device.error && !device.online && (
            <p className="text-[11px] text-destructive">{device.error}</p>
          )}
        </div>
        {canRemove && (
          <Button
            variant="outline"
            size="sm"
            disabled={removing}
            onClick={onRemove}
            className="shrink-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Kaldır
          </Button>
        )}
      </div>
    </div>
  );
}

type FelixDesktopPanelProps = {
  onOpenGuide?: () => void;
  showMobileGuideButton?: boolean;
};

export function FelixDesktopPanel({
  onOpenGuide,
  showMobileGuideButton = false,
}: FelixDesktopPanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isRemoteHub =
    typeof window !== "undefined" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname);
  const [pairCode, setPairCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [baseUrl, setBaseUrl] = useState(isRemoteHub ? "" : "http://127.0.0.1:9477");
  const [generatedCode, setGeneratedCode] = useState<{
    code: string;
    expiresInSec: number;
  } | null>(null);
  const [lastAuthToken, setLastAuthToken] = useState<string | null>(null);

  const { data: whoami } = useQuery({
    queryKey: ["whoami"],
    queryFn: () => apiGet<WhoamiData>("/whoami"),
    staleTime: 60_000,
  });

  const scopes = whoami?.auth?.scopes ?? [];
  const isAdmin = scopes.includes("admin");
  const canPair = scopes.includes("write") || isAdmin;

  const statusQuery = useQuery({
    queryKey: ["sidecar-status"],
    queryFn: fetchSidecarStatus,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const codeMutation = useMutation({
    mutationFn: createSidecarPairingCode,
    onSuccess: (data) => {
      setGeneratedCode({ code: data.code, expiresInSec: data.expiresInSec });
      toast.show("Eşleştirme kodu oluşturuldu");
    },
    onError: (e) =>
      toast.show(e instanceof ApiError ? e.message : "Kod oluşturulamadı", "error"),
  });

  const pairMutation = useMutation({
    mutationFn: pairSidecarDevice,
    onSuccess: (data) => {
      if (data.authToken) setLastAuthToken(data.authToken);
      setPairCode("");
      queryClient.invalidateQueries({ queryKey: ["sidecar-status"] });
      toast.show(`"${data.name}" eşleştirildi`);
    },
    onError: (e) =>
      toast.show(e instanceof ApiError ? e.message : "Eşleştirme başarısız", "error"),
  });

  const removeMutation = useMutation({
    mutationFn: removeSidecarDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sidecar-status"] });
      toast.show("Cihaz kaldırıldı");
    },
    onError: (e) =>
      toast.show(e instanceof ApiError ? e.message : "Cihaz kaldırılamadı", "error"),
  });

  const status = statusQuery.data;
  const loading = statusQuery.isLoading;
  const notConnected =
    status?.sidecarRequired &&
    status.aggregateStatus !== "connected" &&
    status.aggregateStatus !== "not_required";

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.show(`${label} kopyalandı`);
    } catch {
      toast.show("Kopyalama başarısız", "error");
    }
  };

  return (
    <div className="space-y-5">
      {notConnected && (
        <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-orange-500/5 p-4 sm:p-5">
          <div className="flex gap-3">
            <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold text-amber-50">
                Sohbet yerel dosyalara erişemiyor
              </p>
              <p className="text-xs leading-relaxed text-amber-100/90">
                &quot;Documents klasörümü listele&quot; gibi istekler hub&apos;ın Mac&apos;inizdeki{" "}
                {BRAND.desktopAgentName}&apos;a ulaşmasını gerektirir. Şu an bağlantı yok — muhtemelen
                port yönlendirme yapılmadı veya sidecar çevrimdışı.
              </p>
              {showMobileGuideButton && onOpenGuide && (
                <Button variant="outline" size="sm" className="mt-1" onClick={onOpenGuide}>
                  <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                  Bağlantı rehberini aç
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        className={cn(
          "overflow-hidden rounded-2xl border shadow-sm",
          status?.ready
            ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card/80 to-card/40"
            : "border-border/80 bg-gradient-to-br from-violet-500/10 via-card/80 to-card/40",
        )}
      >
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                status?.ready ? "bg-emerald-500/20 text-emerald-400" : "bg-violet-500/20 text-violet-400",
              )}
            >
              <Laptop className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{BRAND.desktopAgentName}</h2>
              <p className="text-sm text-muted-foreground">
                Yerel dosya, terminal ve bildirimler
              </p>
              {loading ? (
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Durum yükleniyor…
                </p>
              ) : status ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge
                    status={sidecarStatusTone(status.aggregateStatus)}
                    label={sidecarStatusLabel(status.aggregateStatus)}
                  />
                  {status.ready ? (
                    <Badge variant="success">Sohbet için hazır</Badge>
                  ) : (
                    <Badge variant="warning">Kurulum gerekli</Badge>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => statusQuery.refetch()}
            disabled={statusQuery.isFetching}
            className="shrink-0"
          >
            <RefreshCw className={cn("mr-1.5 h-4 w-4", statusQuery.isFetching && "animate-spin")} />
            Yenile
          </Button>
        </div>

        {status && (
          <div className="grid gap-px border-t border-border/60 bg-border/40 sm:grid-cols-3">
            {[
              { label: "Ortam", value: status.nodeEnv },
              { label: "Cihaz", value: String(status.deviceCount) },
              {
                label: "Mod",
                value: status.mode === "direct" ? "Doğrudan" : "Delegation",
              },
            ].map((item) => (
              <div key={item.label} className="bg-card/80 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-0.5 text-sm font-medium capitalize">{item.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {status && (
        <SettingsInfoBox
          variant={status.sidecarRequired && !status.ready ? "warning" : "tip"}
          title={status.mode === "direct" ? "Geliştirme modu" : "Production — delegation"}
        >
          {sidecarModeDescription(status.mode, status.nodeEnv)}
          {status.delegateToSidecar && (
            <p className="mt-2 text-xs">
              Hub sunucuda dosya okumaz; eşleşmiş Mac&apos;inizdeki sidecar üzerinden çalışır.
            </p>
          )}
        </SettingsInfoBox>
      )}

      {status?.sidecarRequired && (
        <SettingsSectionCard title="Kurulum kontrol listesi" description="Hepsi tamam olmalı">
          <FelixDesktopChecklist ready={!!status.ready} />
        </SettingsSectionCard>
      )}

      <SettingsSectionCard
        icon={Wifi}
        title="Eşleşmiş cihazlar"
        description="Hub'ın bağlandığı Mac/PC kayıtları"
      >
        {loading ? (
          <div className="flex h-20 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          </div>
        ) : !status?.devices.length ? (
          <EmptyState
            icon={Laptop}
            title={status?.sidecarRequired ? "Henüz cihaz yok" : "Sidecar gerekmez"}
            description={
              status?.sidecarRequired
                ? "Sağdaki rehberi takip edin, ardından aşağıdan eşleştirin."
                : "Geliştirme modunda hub bu makinede doğrudan çalışır."
            }
          />
        ) : (
          <div className="space-y-3">
            {status.devices.map((d) => (
              <DeviceRow
                key={d.id}
                device={d}
                canRemove={isAdmin}
                removing={removeMutation.isPending}
                onRemove={() => removeMutation.mutate(d.id)}
              />
            ))}
          </div>
        )}
      </SettingsSectionCard>

      {isAdmin && status?.sidecarRequired && (
        <SettingsSectionCard title="1 · Eşleştirme kodu" description="Admin — tek kullanımlık kod">
          <div className="space-y-4">
            <Button onClick={() => codeMutation.mutate()} disabled={codeMutation.isPending}>
              {codeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yeni kod oluştur
            </Button>
            {generatedCode && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {generatedCode.expiresInSec}s geçerli — Mac&apos;teki env dosyasına yapıştırmayın, pair
                  formuna girin
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-3xl font-bold tracking-[0.2em]">
                    {generatedCode.code}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(generatedCode.code, "Kod")}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Kopyala
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SettingsSectionCard>
      )}

      {canPair && status?.sidecarRequired && (
        <SettingsSectionCard
          title="2 · Cihaz eşleştir"
          description="Kod + Mac'inizin adresi (sabit IP veya tunnel URL)"
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              pairMutation.mutate({
                code: pairCode.trim(),
                deviceName: deviceName.trim() || "macbook",
                baseUrl: baseUrl.trim(),
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="desktop-pair-code">Kod</Label>
                <Input
                  id="desktop-pair-code"
                  value={pairCode}
                  onChange={(e) => setPairCode(e.target.value)}
                  placeholder="123456"
                  className="font-mono text-lg tracking-widest"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desktop-pair-name">Cihaz adı</Label>
                <Input
                  id="desktop-pair-name"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="macbook"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desktop-pair-url">Base URL</Label>
              <Input
                id="desktop-pair-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={
                  isRemoteHub
                    ? "http://88.248.21.106:9477 veya https://xxx.trycloudflare.com"
                    : "http://127.0.0.1:9477"
                }
                className="font-mono text-sm"
                required
              />
              {isRemoteHub && (
                <p className="text-xs text-muted-foreground">
                  Sabit IP + port forward veya tunnel URL.{" "}
                  <code className="rounded bg-muted px-1">127.0.0.1</code> çalışmaz.
                </p>
              )}
            </div>
            <Button type="submit" disabled={pairMutation.isPending || !pairCode.trim()}>
              {pairMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eşleştir
            </Button>
          </form>

          {lastAuthToken && (
            <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">3 · Token&apos;ı Mac&apos;e kaydet</p>
                  <p className="mt-1 break-all font-mono text-xs">{lastAuthToken}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyText(lastAuthToken, "Token")}
                    >
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      Kopyala
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    <code>~/.config/felix-desktop/env</code> →{" "}
                    <code>SIDECAR_AUTH_TOKEN=…</code> →{" "}
                    <code>npm run sidecar:pm2:restart</code>
                  </p>
                </div>
              </div>
            </div>
          )}
        </SettingsSectionCard>
      )}

      {!isAdmin && status?.sidecarRequired && (
        <SettingsInfoBox variant="default" title="Yetki">
          Kod oluşturmak ve cihaz silmek için admin gerekir. Eşleştirme için write yetkisi yeterli.
        </SettingsInfoBox>
      )}

      {status?.aggregateStatus === "connected" && status.sidecarRequired && (
        <SettingsInfoBox variant="tip" title="Bağlantı tamam — macOS izinleri">
          <p className="text-xs leading-relaxed">
            Çevrimiçi görünüyorsanız hub Mac&apos;inize ulaşıyor demektir. Screenshot veya masaüstü
            kontrolü için ayrıca <strong>Ekran Kaydı</strong> ve <strong>Erişilebilirlik</strong>{" "}
            izni verin (PM2 → <code className="rounded bg-muted px-1">node</code>). İzin sonrası{" "}
            <code className="rounded bg-muted px-1">npm run sidecar:pm2:restart</code>
          </p>
        </SettingsInfoBox>
      )}

      {status?.aggregateStatus === "offline" && status.devices.length > 0 && (
        <SettingsInfoBox variant="warning" title="Hub Mac'e ulaşamıyor">
          <p className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 shrink-0" />
            Cihaz kayıtlı ama çevrimdışı. PM2 çalışıyor mu? Port forward veya tunnel açık mı?
          </p>
        </SettingsInfoBox>
      )}
    </div>
  );
}

/** @deprecated Use FelixDesktopPanel — kept for settings redirect compatibility */
export function SidecarSettingsPanel() {
  return <FelixDesktopPanel />;
}
