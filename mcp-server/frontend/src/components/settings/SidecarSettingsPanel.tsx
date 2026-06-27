import { useState } from "react";
import {
  Copy,
  Laptop,
  Loader2,
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
import {
  SettingsInfoBox,
  SettingsSectionCard,
  SettingsStepList,
} from "@/components/settings/shared";
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
import { formatTime } from "@/lib/utils";

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
    <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{device.name}</p>
            <StatusBadge
              status={device.online ? "healthy" : "error"}
              label={device.online ? "Çevrimiçi" : "Çevrimdışı"}
              className="text-[10px]"
            />
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">{device.baseUrl}</p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {(device.capabilities ?? ["fs"]).map((cap) => (
              <Badge key={cap} variant="default" className="text-[10px] font-normal">
                {cap}
              </Badge>
            ))}
          </div>
          {device.pairedAt && (
            <p className="text-[11px] text-muted-foreground">
              Eşleştirildi: {formatTime(device.pairedAt)}
              {device.lastSeenAt ? ` · Son görülme: ${formatTime(device.lastSeenAt)}` : ""}
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

export function SidecarSettingsPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isRemoteHub =
    typeof window !== "undefined" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname);
  const [pairCode, setPairCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [baseUrl, setBaseUrl] = useState(
    isRemoteHub ? "" : "http://127.0.0.1:9477",
  );
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

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.show(`${label} panoya kopyalandı`);
    } catch {
      toast.show("Kopyalama başarısız", "error");
    }
  };

  return (
    <div className="space-y-5">
      <SettingsSectionCard
        icon={Laptop}
        title="Yerel erişim modu"
        description="Hub'ın dosya, terminal ve bildirim işlemlerini nerede çalıştırdığını gösterir."
        accent
      >
        {loading ? (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Durum yükleniyor…
          </div>
        ) : status ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={sidecarStatusTone(status.aggregateStatus)}
                label={sidecarStatusLabel(status.aggregateStatus)}
              />
              <Badge variant="default" className="font-normal">
                NODE_ENV: {status.nodeEnv}
              </Badge>
              <Badge variant="default" className="font-normal">
                {status.mode === "direct" ? "Doğrudan erişim" : `${BRAND.desktopAgentName} delegation`}
              </Badge>
              {status.ready ? (
                <Badge variant="success">Hazır</Badge>
              ) : (
                <Badge variant="warning">Yapılandırma gerekli</Badge>
              )}
            </div>

            <SettingsInfoBox
              variant={status.sidecarRequired && !status.ready ? "warning" : "tip"}
              title={status.mode === "direct" ? "Geliştirme modu" : "Production modu"}
            >
              {sidecarModeDescription(status.mode, status.nodeEnv)}
              {status.localFsOnServer && (
                <p className="mt-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">LOCAL_FS_ON_SERVER</code>{" "}
                  etkin veya varsayılan dev davranışı aktif — {BRAND.desktopAgentName} çalıştırmanız gerekmez.
                </p>
              )}
              {status.delegateToSidecar && (
                <p className="mt-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">LOCAL_FS_ON_SERVER=false</code>{" "}
                  — yerel işlemler eşleştirilmiş {BRAND.desktopAgentName} üzerinden yapılır.
                </p>
              )}
            </SettingsInfoBox>

            {status.sidecarRequired && isRemoteHub && (
              <SettingsInfoBox variant="warning" title="Uzak hub — sidecar erişimi">
                Hub sunucuda; PC&apos;nizdeki sidecar&apos;a erişmesi gerekir. Sabit IP&apos;niz varsa{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">SIDECAR_BIND=0.0.0.0</code> + modem
                port forward <code className="rounded bg-muted px-1.5 py-0.5 text-xs">9477</code> ile{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">http://SABIT_IP:9477</code> pair
                edin (tunnel gerekmez). Sabit IP yoksa{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run sidecar:tunnel</code>.
                Rehber: <code className="text-xs">docs/SIDECAR-REMOTE-HUB.md</code>
              </SettingsInfoBox>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <p className="text-xs text-muted-foreground">Ortam</p>
                <p className="mt-0.5 font-medium capitalize">{status.nodeEnv}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <p className="text-xs text-muted-foreground">Eşleşmiş cihaz</p>
                <p className="mt-0.5 font-medium tabular-nums">{status.deviceCount}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <p className="text-xs text-muted-foreground">Bağlantı</p>
                <p className="mt-0.5 flex items-center gap-1.5 font-medium">
                  {status.aggregateStatus === "connected" ||
                  status.aggregateStatus === "not_required" ? (
                    <Wifi className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-destructive" />
                  )}
                  {sidecarStatusLabel(status.aggregateStatus)}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => statusQuery.refetch()}
              disabled={statusQuery.isFetching}
            >
              <RefreshCw
                className={`mr-1.5 h-4 w-4 ${statusQuery.isFetching ? "animate-spin" : ""}`}
              />
              Bağlantıyı yenile
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{BRAND.desktopAgentName} durumu alınamadı.</p>
        )}
      </SettingsSectionCard>

      <SettingsSectionCard
        icon={Wifi}
        title="Eşleşmiş cihazlar"
        description={`${BRAND.hubName}'ın yerel dosya ve terminal işlemlerini yönlendirdiği ${BRAND.desktopAgentName} kayıtları.`}
      >
        {loading ? (
          <div className="flex h-20 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          </div>
        ) : !status?.devices.length ? (
          <EmptyState
            icon={Laptop}
            title={
              status?.sidecarRequired
                ? "Henüz cihaz eşleştirilmedi"
                : `${BRAND.desktopAgentName} gerekmez`
            }
            description={
              status?.sidecarRequired
                ? `Aşağıdaki adımlarla ${BRAND.desktopAgentName}'u başlatın ve eşleştirin.`
                : "Geliştirme modunda hub bu makinede doğrudan çalışır; daemon kurulumu zorunlu değil."
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

      {status?.sidecarRequired && (
        <SettingsSectionCard
          title="Kurulum"
          description={`Production veya delegation modunda ${BRAND.desktopAgentName} gereklidir.`}
        >
          <SettingsStepList
            steps={
              isRemoteHub
                ? [
                    "PC'de: `npm run sidecar:install`",
                    "Sabit IP: `~/.config/felix-desktop/env` → `SIDECAR_BIND=0.0.0.0`, modemde 9477 port forward",
                    "Pair baseUrl: `http://SABIT_IP:9477` (tunnel yok) veya tunnel URL (`npm run sidecar:tunnel`)",
                    "Yönetici: eşleştirme kodu oluştur → cihaz eşleştir",
                    "authToken → `SIDECAR_AUTH_TOKEN` olarak env dosyasına; daemon yeniden başlat",
                  ]
                : [
                    "Terminalde mcp-server dizininde `npm run sidecar:daemon` çalıştırın (127.0.0.1:9477).",
                    "Yönetici olarak eşleştirme kodu oluşturun (aşağıdaki bölüm).",
                    "Kodu sidecar makinesinden veya write yetkili anahtarla `/sidecar/pair` ile onaylayın.",
                    "Yanıttaki authToken'ı daemon ortamında `SIDECAR_AUTH_TOKEN` olarak ayarlayın ve daemon'u yeniden başlatın.",
                  ]
            }
          />
        </SettingsSectionCard>
      )}

      {isAdmin && status?.sidecarRequired && (
        <SettingsSectionCard title="Eşleştirme kodu" description="Yönetici — tek kullanımlık kod üretin.">
          <div className="space-y-4">
            <Button
              onClick={() => codeMutation.mutate()}
              disabled={codeMutation.isPending}
            >
              {codeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Yeni kod oluştur
            </Button>
            {generatedCode && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                <p className="text-sm text-muted-foreground">Kod ({generatedCode.expiresInSec}s geçerli)</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-2xl font-semibold tracking-widest">
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
          title="Cihaz eşleştir"
          description="Write yetkisi — kodu sidecar base URL ile birlikte gönderin."
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              pairMutation.mutate({
                code: pairCode.trim(),
                deviceName: deviceName.trim() || "sidecar",
                baseUrl: baseUrl.trim(),
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sidecar-code">Eşleştirme kodu</Label>
                <Input
                  id="sidecar-code"
                  value={pairCode}
                  onChange={(e) => setPairCode(e.target.value)}
                  placeholder="123456"
                  className="font-mono"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sidecar-name">Cihaz adı</Label>
                <Input
                  id="sidecar-name"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="my-mac"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sidecar-url">{BRAND.desktopAgentName} base URL</Label>
              <Input
                id="sidecar-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={
                  isRemoteHub
                    ? "http://SABIT_IP:9477 veya https://xxxx.trycloudflare.com"
                    : "http://127.0.0.1:9477"
                }
                className="font-mono text-sm"
                required
              />
              {isRemoteHub && (
                <p className="text-xs text-muted-foreground">
                  Sabit IP: <code className="rounded bg-muted px-1">http://IP:9477</code> + port forward.
                  Yoksa: <code className="rounded bg-muted px-1">npm run sidecar:tunnel</code>
                </p>
              )}
            </div>
            <Button type="submit" disabled={pairMutation.isPending || !pairCode.trim()}>
              {pairMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eşleştir
            </Button>
          </form>

          {lastAuthToken && (
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              <p className="font-medium text-amber-100">Auth token (yalnızca bir kez gösterilir)</p>
              <p className="mt-1 break-all font-mono text-xs">{lastAuthToken}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => copyText(lastAuthToken, "Token")}
              >
                <Copy className="mr-1 h-3.5 w-3.5" />
                Token'ı kopyala
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                <code className="rounded bg-muted px-1">~/.config/felix-desktop/env</code> içine{" "}
                <code>SIDECAR_AUTH_TOKEN=…</code> yazın, ardından{" "}
                <code>npm run sidecar:daemon</code>
              </p>
            </div>
          )}
        </SettingsSectionCard>
      )}

      {!isAdmin && status?.sidecarRequired && (
        <SettingsInfoBox variant="default" title="Yetki">
          Eşleştirme kodu oluşturmak ve cihaz kaldırmak için admin yetkisi gerekir. Durum bilgisini
          görüntüleyebilirsiniz.
        </SettingsInfoBox>
      )}
    </div>
  );
}
