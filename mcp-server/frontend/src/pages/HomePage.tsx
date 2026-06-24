import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  Database,
  LayoutGrid,
  MessageSquare,
  Plug,
  RefreshCw,
  Settings,
  Shield,
  ShieldAlert,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, type ChatModelsData, type HealthData, type PluginInfo, type WhoamiData } from "@/lib/api-client";
import { fetchDashboardBundle } from "@/lib/dashboard-api";
import { fetchUsageStats, formatCostUsd, formatTokenCount } from "@/lib/usage-api";
import { cn, formatDuration, formatTime } from "@/lib/utils";
import type { ReactNode } from "react";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  status,
  delay = 0,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  status?: "healthy" | "ok" | "warning" | "degraded" | "error";
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Card className="h-full overflow-hidden">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              {status && <StatusBadge status={status} className="text-[10px]" />}
            </div>
            <p className="mt-0.5 truncate text-2xl font-semibold tabular-nums">{value}</p>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{hint}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-xs text-primary hover:underline">
      {children}
    </Link>
  );
}

export function HomePage() {
  const {
    data: health,
    isLoading: healthLoading,
    isError: healthError,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<HealthData>("/health"),
    staleTime: 30_000,
  });

  const { data: whoami } = useQuery({
    queryKey: ["whoami"],
    queryFn: () => apiGet<WhoamiData>("/whoami"),
    staleTime: 60_000,
  });

  const { data: plugins = [], isLoading: pluginsLoading } = useQuery({
    queryKey: ["plugins"],
    queryFn: () => apiGet<PluginInfo[]>("/plugins"),
    staleTime: 60_000,
  });

  const { data: chatModels } = useQuery({
    queryKey: ["chat-models"],
    queryFn: () => apiGet<ChatModelsData>("/ui/chat/models"),
    staleTime: 60_000,
  });

  const {
    data: bundle,
    isLoading: bundleLoading,
    refetch: refetchBundle,
    isFetching,
  } = useQuery({
    queryKey: ["dashboard-bundle"],
    queryFn: fetchDashboardBundle,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: usageStats } = useQuery({
    queryKey: ["usage-stats"],
    queryFn: () => fetchUsageStats(7),
    staleTime: 30_000,
  });

  const toolCount = plugins.reduce((n, p) => n + (Array.isArray(p.tools) ? p.tools.length : 0), 0);
  const loading = healthLoading || pluginsLoading || bundleLoading;

  const successRate = useMemo(() => {
    if (!bundle?.auditStats?.total) return null;
    const ok = bundle.auditStats.total - bundle.auditStats.errors;
    return Math.round((ok / bundle.auditStats.total) * 100);
  }, [bundle?.auditStats]);

  const topPlugins = useMemo(() => {
    if (!bundle?.auditStats?.byPlugin) return [];
    return Object.entries(bundle.auditStats.byPlugin)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6);
  }, [bundle?.auditStats]);

  const integrationSummary = useMemo(() => {
    const groups = bundle?.envCatalog?.groups ?? [];
    const vars = groups.flatMap((g) => g.vars);
    const configured = vars.filter((v) => v.configured).length;
    const required = vars.filter((v) => v.required);
    const missingRequired = required.filter((v) => !v.configured);
    const pluginsWithGaps = groups
      .map((g) => {
        const missing = g.vars.filter((v) => v.required && !v.configured);
        return { ...g, missing };
      })
      .filter((g) => g.missing.length > 0)
      .slice(0, 5);
    return { total: vars.length, configured, missingRequired, pluginsWithGaps };
  }, [bundle?.envCatalog]);

  const refreshAll = () => {
    void refetchHealth();
    void refetchBundle();
  };

  const memoryTotal = bundle?.brainStats?.memories?.total ?? 0;
  const pendingApprovals = bundle?.approvals?.length ?? 0;
  const activeProvider = chatModels?.provider ?? "—";
  const modelReady = chatModels?.providerAvailable !== false;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Kontrol Paneli"
        description="Sistem durumu, aktivite ve entegrasyonlar — tek bakışta."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {whoami?.project && (
              <Badge className="border border-border/60 bg-transparent font-normal">
                {whoami.project.id} / {whoami.project.env}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={isFetching}>
              <RefreshCw className={cn("mr-1.5 h-4 w-4", isFetching && "animate-spin")} />
              Yenile
            </Button>
          </div>
        }
      />

      {healthError && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
          Sunucuya ulaşılamıyor. Bağlantını ve backend sürecini kontrol et.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Sistem"
              value={bundle?.obsHealth?.uptime?.human ?? "—"}
              hint={`${bundle?.obsHealth?.memory?.heapUsedMb ?? "—"} MB bellek · ${health?.persistence?.enabled ? "Kalıcı depo açık" : "Depo kapalı"}`}
              icon={Activity}
              status={bundle?.obsHealth?.status === "healthy" ? "healthy" : "warning"}
              delay={0}
            />
            <StatCard
              label="İstekler"
              value={bundle?.auditStats?.total?.toLocaleString("tr-TR") ?? "—"}
              hint={
                successRate != null
                  ? `%${successRate} başarı · ${bundle?.auditStats?.errors ?? 0} hata`
                  : "Henüz istek yok"
              }
              icon={Zap}
              status={(bundle?.auditStats?.errors ?? 0) > 0 ? "warning" : "ok"}
              delay={0.04}
            />
            <StatCard
              label="Sohbet motoru"
              value={activeProvider}
              hint={`${chatModels?.defaultModel ?? "—"} · ${chatModels?.toolCount ?? 0} araç${modelReady ? "" : " · yapılandırma gerekli"}`}
              icon={Bot}
              status={modelReady ? "ok" : "warning"}
              delay={0.08}
            />
            <StatCard
              label="Brain bellek"
              value={memoryTotal}
              hint={`${bundle?.brainStats?.projects?.total ?? 0} proje · ${Object.keys(bundle?.brainStats?.memories?.byType ?? {}).length} tür`}
              icon={Brain}
              status={memoryTotal > 0 ? "ok" : "degraded"}
              delay={0.12}
            />
            <StatCard
              label="Token (7 gün)"
              value={formatTokenCount(usageStats?.totalTokens ?? 0)}
              hint={`${usageStats?.callCount ?? 0} LLM çağrısı`}
              icon={Zap}
              status="ok"
              delay={0.16}
            />
            <StatCard
              label="Tahmini maliyet"
              value={formatCostUsd(usageStats?.estimatedCostUsd ?? 0)}
              hint="Son 7 gün · USD tahmini"
              icon={Coins}
              status="ok"
              delay={0.2}
            />
          </>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Eklentiler"
              value={plugins.length}
              hint={`${toolCount} kayıtlı araç`}
              icon={LayoutGrid}
              status="ok"
            />
            <StatCard
              label="Entegrasyonlar"
              value={`${integrationSummary.configured}/${integrationSummary.total || "—"}`}
              hint={
                integrationSummary.missingRequired.length > 0
                  ? `${integrationSummary.missingRequired.length} zorunlu anahtar eksik`
                  : "Tüm zorunlu anahtarlar tamam"
              }
              icon={Plug}
              status={integrationSummary.missingRequired.length > 0 ? "warning" : "healthy"}
            />
            <StatCard
              label="Bekleyen onay"
              value={pendingApprovals}
              hint={
                (bundle?.jobStats?.running ?? 0) > 0
                  ? `${bundle?.jobStats?.running} iş çalışıyor`
                  : "Politika onayı veya iş kuyruğu"
              }
              icon={pendingApprovals > 0 ? ShieldAlert : Shield}
              status={pendingApprovals > 0 ? "warning" : "ok"}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 py-3">
            <CardTitle className="text-sm font-medium">Son işlemler</CardTitle>
            <PanelLink to="/audit">Tümünü gör →</PanelLink>
          </CardHeader>
          <CardContent className="p-0">
            {bundleLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (bundle?.operations?.length ?? 0) === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Henüz kayıtlı işlem yok</p>
            ) : (
              <div className="divide-y divide-border/60">
                {bundle!.operations.map((op) => (
                  <div
                    key={`${op.timestamp}-${op.operation}`}
                    className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/30"
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        op.success ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                      )}
                    >
                      {op.success ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{op.operation}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {op.plugin} · {op.actor ?? "sistem"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      <p>{formatTime(op.timestamp)}</p>
                      {op.durationMs != null && <p>{formatDuration(op.durationMs)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 py-3">
              <CardTitle className="text-sm font-medium">Eklenti aktivitesi</CardTitle>
              <PanelLink to="/observability">Metrikler →</PanelLink>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {topPlugins.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aktivite verisi yok</p>
              ) : (
                topPlugins.map(([name, stat]) => {
                  const pct = bundle?.auditStats?.total
                    ? Math.round((stat.total / bundle.auditStats.total) * 100)
                    : 0;
                  return (
                    <div key={name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {stat.total} · ~{formatDuration(stat.avgDuration)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 py-3">
              <CardTitle className="text-sm font-medium">Son sohbetler</CardTitle>
              <PanelLink to="/chat">Sohbete git →</PanelLink>
            </CardHeader>
            <CardContent className="p-0">
              {(bundle?.conversations?.length ?? 0) === 0 ? (
                <div className="space-y-3 p-4 text-center">
                  <p className="text-sm text-muted-foreground">Henüz kayıtlı sohbet yok</p>
                  <Button size="sm" asChild>
                    <Link to="/chat">İlk sohbeti başlat</Link>
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {bundle!.conversations.map((c) => (
                    <Link
                      key={c.id}
                      to={`/chat?c=${c.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                    >
                      <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.messageCount} mesaj · {formatTime(c.updatedAt)}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 py-3">
            <CardTitle className="text-sm font-medium">Eksik entegrasyonlar</CardTitle>
            <PanelLink to="/settings">Ayarlar →</PanelLink>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {integrationSummary.pluginsWithGaps.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Zorunlu entegrasyon anahtarları tamam görünüyor
              </div>
            ) : (
              integrationSummary.pluginsWithGaps.map((g) => (
                <div
                  key={g.plugin}
                  className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                >
                  <p className="text-sm font-medium">{g.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Eksik: {g.missing.map((v) => v.name).join(", ")}
                  </p>
                </div>
              ))
            )}
            {!modelReady && chatModels?.providerHint && (
              <p className="text-xs text-amber-300/90">{chatModels.providerHint}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60 py-3">
            <CardTitle className="text-sm font-medium">Hızlı erişim</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 sm:grid-cols-2">
            {[
              { to: "/chat", label: "Sohbet", icon: Bot, desc: "LLM + araçlar" },
              { to: "/brain", label: "Brain", icon: Brain, desc: `${memoryTotal} bellek` },
              { to: "/tools", label: "Araçlar", icon: Wrench, desc: `${toolCount} araç` },
              { to: "/plugins", label: "Eklentiler", icon: LayoutGrid, desc: `${plugins.length} yüklü` },
              { to: "/settings", label: "Ayarlar", icon: Settings, desc: "Entegrasyonlar" },
              { to: "/audit", label: "Denetim", icon: Shield, desc: "İşlem kayıtları" },
            ].map((item, i) => (
              <motion.div
                key={item.to}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <Link
                  to={item.to}
                  className="group flex items-center gap-3 rounded-xl border border-border/60 p-3 transition-all hover:border-primary/30 hover:bg-muted/30"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-medium">
                      {item.label}
                      <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                    <span className="text-xs text-muted-foreground">{item.desc}</span>
                  </span>
                </Link>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </div>

      {(bundle?.obsHealth?.plugins?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Cpu className="h-4 w-4 text-primary" />
              Eklenti sağlığı
            </CardTitle>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {bundle?.obsHealth?.uptime?.human}
            </span>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {bundle!.obsHealth!.plugins!.slice(0, 20).map((p) => (
                <Badge
                  key={p.name}
                  className={cn(
                    "font-normal",
                    (p.errors ?? 0) > 0
                      ? "border-destructive/40 bg-destructive/15 text-red-300"
                      : "border-border/60 bg-muted/30"
                  )}
                >
                  {p.name}
                  {(p.calls ?? 0) > 0 && <span className="ml-1 opacity-70">· {p.calls}</span>}
                </Badge>
              ))}
              {(bundle?.obsHealth?.plugins?.length ?? 0) > 20 && (
                <Badge className="font-normal">+{(bundle?.obsHealth?.plugins?.length ?? 0) - 20}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {health?.persistence && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <Database className="h-4 w-4 shrink-0" />
          <span>
            Depolama: <strong className="text-foreground">{health.persistence.status}</strong>
            {health.persistence.enabled && health.persistence.schemaVersion != null && (
              <> · şema v{health.persistence.schemaVersion}</>
            )}
            {health.auth && <> · Kimlik doğrulama {health.auth}</>}
          </span>
        </div>
      )}
    </div>
  );
}
