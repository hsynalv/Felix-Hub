import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Cpu,
  Gauge,
  HeartPulse,
  RefreshCw,
  Server,
  Timer,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/layout/StatusBadge";
import {
  OpsPageHero,
  OpsPageShell,
  OpsPanel,
  OpsStatCard,
  OpsStatGrid,
} from "@/components/ops/OpsPrimitives";
import { apiGetRaw } from "@/lib/api-client";
import { fetchObservabilityProDashboard } from "@/lib/inbox-api";
import { cn, formatTime } from "@/lib/utils";

const METRIC_ICONS: Record<string, typeof Activity> = {
  uptime: Timer,
  requests: Zap,
  errors: AlertTriangle,
  memory: Server,
  cpu: Cpu,
  plugins: Gauge,
};

function pickMetricIcon(key: string) {
  const lower = key.toLowerCase();
  for (const [k, icon] of Object.entries(METRIC_ICONS)) {
    if (lower.includes(k)) return icon;
  }
  return Activity;
}

function formatMetricValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("value" in o) return formatMetricValue(o.value);
    return JSON.stringify(v);
  }
  return String(v);
}

export function ObservabilityPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(() => new Date());

  const { data: health, isLoading: healthLoading, refetch: refetchHealth, isFetching: healthFetching } = useQuery({
    queryKey: ["obs-health"],
    queryFn: async () => {
      const r = await apiGetRaw<Record<string, unknown>>("/observability/health");
      setLastRefresh(new Date());
      return r;
    },
    refetchInterval: autoRefresh ? 15_000 : false,
  });

  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics, isFetching: metricsFetching } = useQuery({
    queryKey: ["obs-metrics"],
    queryFn: async () => {
      const r = await apiGetRaw<Record<string, unknown>>("/observability/metrics");
      setLastRefresh(new Date());
      return r;
    },
    refetchInterval: autoRefresh ? 15_000 : false,
  });

  const { data: obsPro, isLoading: obsProLoading } = useQuery({
    queryKey: ["obs-pro-dashboard"],
    queryFn: () => fetchObservabilityProDashboard(7),
    refetchInterval: autoRefresh ? 30_000 : false,
  });

  const { data: errors, isLoading: errorsLoading } = useQuery({
    queryKey: ["obs-errors"],
    queryFn: () =>
      apiGetRaw<{ errors?: Array<Record<string, unknown>>; data?: { errors?: Array<Record<string, unknown>> } }>(
        "/observability/errors?limit=20"
      ),
    refetchInterval: autoRefresh ? 15_000 : false,
  });

  const errorList = errors?.errors ?? errors?.data?.errors ?? [];
  const healthData = (health?.data ?? health) as Record<string, unknown>;
  const metricsData = (metrics?.data ?? metrics) as Record<string, unknown>;

  const metricCards = useMemo(
    () =>
      Object.entries(metricsData || {})
        .filter(([k]) => !["ok", "data"].includes(k))
        .slice(0, 7),
    [metricsData]
  );

  const isHealthy = String(healthData?.status) === "ok";
  const isRefreshing = healthFetching || metricsFetching;

  const refreshAll = () => {
    void refetchHealth();
    void refetchMetrics();
  };

  return (
    <OpsPageShell>
      <OpsPageHero
        icon={HeartPulse}
        title="Observability"
        description="Canlı sağlık durumu, runtime metrikleri ve son hata akışı."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-border/50 bg-muted/20 px-3 py-1.5">
              <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <Label htmlFor="auto-refresh" className="cursor-pointer text-xs">
                Otomatik (15s)
              </Label>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={refreshAll} disabled={isRefreshing}>
              <RefreshCw className={cn("mr-1.5 h-4 w-4", isRefreshing && "animate-spin")} />
              Yenile
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn(
            "inline-flex h-2 w-2 rounded-full",
            isHealthy ? "bg-success animate-pulse" : "bg-amber-500"
          )}
        />
        Son güncelleme: {formatTime(lastRefresh.toISOString())}
        {autoRefresh && <Badge className="rounded-full text-[10px] border border-border/60 bg-muted/30">canlı</Badge>}
      </div>

      <OpsStatGrid>
        {healthLoading || metricsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-2xl" />)
        ) : (
          <>
            <OpsStatCard
              label="Sistem durumu"
              value={String(healthData?.status ?? "—")}
              hint="Hub health endpoint"
              icon={HeartPulse}
              status={isHealthy ? "healthy" : "warning"}
              tone={isHealthy ? "success" : "warning"}
              delay={0.05}
            />
            <OpsStatCard
              label="Son hatalar"
              value={errorList.length}
              hint="Son 20 kayıt"
              icon={AlertTriangle}
              tone={errorList.length > 0 ? "danger" : "success"}
              delay={0.1}
            />
            {metricCards.slice(0, 2).map(([k, v], i) => (
              <OpsStatCard
                key={k}
                label={k.replace(/_/g, " ")}
                value={formatMetricValue(v)}
                icon={pickMetricIcon(k)}
                delay={0.15 + i * 0.05}
              />
            ))}
          </>
        )}
      </OpsStatGrid>

      {!metricsLoading && metricCards.length > 2 && (
        <OpsPanel title="Runtime Metrikleri" description="Sunucudan gelen ham metrik özeti">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metricCards.slice(2).map(([k, v], i) => (
              <motion.div
                key={k}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border border-border/50 bg-background/40 p-4"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {(() => {
                    const Icon = pickMetricIcon(k);
                    return <Icon className="h-3.5 w-3.5" />;
                  })()}
                  <span className="capitalize">{k.replace(/_/g, " ")}</span>
                </div>
                <p className="mt-2 truncate font-mono text-lg font-semibold tabular-nums">
                  {formatMetricValue(v)}
                </p>
              </motion.div>
            ))}
          </div>
        </OpsPanel>
      )}

      <OpsPanel title="Agent Observability Pro" description="Son 7 gün — failure hotspot, onay darboğazı, maliyet">
        {obsProLoading ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : obsPro ? (
          <div className="space-y-4">
            <OpsStatGrid>
              <OpsStatCard label="Run (7g)" value={obsPro.runs.total} icon={Activity} delay={0.05} />
              <OpsStatCard
                label="Başarısız"
                value={obsPro.runs.failed}
                icon={AlertTriangle}
                tone={obsPro.runs.failed > 0 ? "danger" : "success"}
                delay={0.1}
              />
              <OpsStatCard label="Bekleyen onay" value={obsPro.approvalQueue.pending} icon={Gauge} delay={0.15} />
              <OpsStatCard label="Maliyet (USD)" value={obsPro.totalCostUsd.toFixed(4)} icon={Zap} delay={0.2} />
            </OpsStatGrid>
            {obsPro.failureHotspots.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Failure hotspots</p>
                <ul className="space-y-1 font-mono text-sm">
                  {obsPro.failureHotspots.slice(0, 5).map((h) => (
                    <li key={h.tool} className="flex justify-between gap-2 border-b border-border/40 py-1">
                      <span>{h.tool}</span>
                      <span className="text-muted-foreground">
                        {h.fails}/{h.calls} ({Math.round(h.failRate * 100)}%)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {obsPro.approvalBottlenecks.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Onay darboğazları</p>
                <ul className="space-y-1 text-sm">
                  {obsPro.approvalBottlenecks.map((b) => (
                    <li key={b.tool} className="flex justify-between">
                      <span>{b.tool}</span>
                      <Badge variant="outline">{b.pendingCount} bekliyor</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Agent metrikleri yüklenemedi.</p>
        )}
      </OpsPanel>

      <OpsPanel title="Hata Akışı" description="En son yakalanan hatalar ve uyarılar">
        {errorsLoading ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : !Array.isArray(errorList) || errorList.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="rounded-full bg-success/15 p-3">
              <HeartPulse className="h-6 w-6 text-success" />
            </div>
            <p className="text-sm font-medium">Hata yok</p>
            <p className="text-xs text-muted-foreground">Sistem şu an temiz görünüyor</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {errorList.map((e, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-xl border border-destructive/15 bg-destructive/5 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status="error" label={String(e.level || "error")} className="text-[10px]" />
                  <span className="text-xs text-muted-foreground">{formatTime(String(e.timestamp || ""))}</span>
                </div>
                <p className="mt-2 font-mono text-xs leading-relaxed text-foreground/90">
                  {String(e.message || JSON.stringify(e))}
                </p>
              </motion.li>
            ))}
          </ul>
        )}
      </OpsPanel>
    </OpsPageShell>
  );
}
