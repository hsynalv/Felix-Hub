import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Coins,
  Gauge,
  Hash,
  Layers,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  OpsPageHero,
  OpsPageShell,
  OpsPanel,
  OpsPill,
  OpsStatCard,
  OpsStatGrid,
  OpsToolbar,
} from "@/components/ops/OpsPrimitives";
import { cn, formatTime } from "@/lib/utils";
import {
  checkProjectQuota,
  fetchCostAnomalies,
  fetchUsageEvents,
  fetchUsageStats,
  fetchUsageSummary,
  formatCostUsd,
  formatTokenCount,
  usageRangePresets,
  type UsageGroup,
  type UsageGroupBy,
} from "@/lib/usage-api";
import { getProjectId } from "@/lib/project-context";

const GROUP_LABELS: Record<UsageGroupBy, string> = {
  tool: "Araç",
  model: "Model",
  source: "Kaynak",
  day: "Gün",
  plugin: "Plugin",
};

const EVENTS_PAGE_SIZE = 25;

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function DailyTrendChart({ groups }: { groups: UsageGroup[] }) {
  const sorted = useMemo(
    () => [...groups].sort((a, b) => a.key.localeCompare(b.key)),
    [groups]
  );
  const maxTokens = Math.max(...sorted.map((g) => g.totalTokens), 1);

  if (!sorted.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
        <Calendar className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Bu aralıkta günlük veri yok</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex h-44 items-end gap-1.5 sm:gap-2">
        {sorted.map((g, i) => {
          const height = Math.max(8, (g.totalTokens / maxTokens) * 100);
          const label = g.key.length >= 10 ? g.key.slice(5, 10) : g.key;
          return (
            <motion.div
              key={g.key}
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{ delay: i * 0.03, duration: 0.25 }}
              className="group flex min-w-0 flex-1 flex-col items-center gap-1.5"
              style={{ transformOrigin: "bottom" }}
            >
              <div className="relative flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-primary/80 to-primary/40 transition-opacity group-hover:from-primary group-hover:to-primary/60"
                  style={{ height: `${height}%` }}
                  title={`${g.key}: ${formatTokenCount(g.totalTokens)} token · ${formatCostUsd(g.estimatedCostUsd)}`}
                />
              </div>
              <span className="truncate text-[9px] text-muted-foreground sm:text-[10px]">{label}</span>
            </motion.div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 border-t border-border/40 pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary/70" />
          Token hacmi (günlük)
        </span>
        <span>
          Toplam: {formatTokenCount(sorted.reduce((s, g) => s + g.totalTokens, 0))} ·{" "}
          {formatCostUsd(sorted.reduce((s, g) => s + g.estimatedCostUsd, 0))}
        </span>
      </div>
    </div>
  );
}

function BreakdownRow({
  group,
  maxTokens,
  rank,
}: {
  group: UsageGroup;
  maxTokens: number;
  rank: number;
}) {
  const width = Math.max(3, (group.totalTokens / maxTokens) * 100);
  const promptShare = pct(group.promptTokens, group.totalTokens);
  const completionShare = pct(group.completionTokens, group.totalTokens);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.03 }}
      className="rounded-xl border border-border/40 bg-background/30 p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-[10px] font-semibold text-muted-foreground">
            {rank}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{group.key}</p>
            <p className="text-[11px] text-muted-foreground">
              {group.callCount.toLocaleString("tr-TR")} çağrı · ort.{" "}
              {group.callCount ? formatTokenCount(Math.round(group.totalTokens / group.callCount)) : "—"} / çağrı
            </p>
          </div>
        </div>
        <div className="text-right text-sm tabular-nums">
          <p className="font-semibold">{formatTokenCount(group.totalTokens)}</p>
          <p className="text-xs text-muted-foreground">{formatCostUsd(group.estimatedCostUsd)}</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${width}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <ArrowUpRight className="h-3 w-3 text-sky-500" />
          Prompt {formatTokenCount(group.promptTokens)} ({promptShare}%)
        </span>
        <span className="flex items-center gap-1">
          <ArrowDownLeft className="h-3 w-3 text-violet-500" />
          Completion {formatTokenCount(group.completionTokens)} ({completionShare}%)
        </span>
      </div>
    </motion.div>
  );
}

function QuotaPanel({
  projectId,
  loading,
  quota,
}: {
  projectId: string;
  loading: boolean;
  quota?: {
    allowed: boolean;
    warning?: boolean;
    usage?: { totalTokens: number; estimatedCostUsd: number };
    quota?: { limitUsd?: number | null; hardStop?: boolean; alertThreshold?: number };
  };
}) {
  if (loading) return <Skeleton className="h-48 rounded-xl" />;

  const usage = quota?.usage;
  const limit = quota?.quota?.limitUsd;
  const costPct = limit && usage ? Math.min(100, (usage.estimatedCostUsd / limit) * 100) : null;

  return (
    <div className="space-y-4">
      {quota?.warning && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Aylık kota limitine yaklaşılıyor veya aşıldı.</span>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border/50 bg-background/40 p-4">
          <p className="text-xs text-muted-foreground">Bu ay maliyet</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {usage ? formatCostUsd(usage.estimatedCostUsd) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border/50 bg-background/40 p-4">
          <p className="text-xs text-muted-foreground">Bu ay token</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {usage ? formatTokenCount(usage.totalTokens) : "—"}
          </p>
        </div>
      </div>
      {limit != null && costPct != null && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Aylık limit</span>
            <span className="font-medium tabular-nums">
              {formatCostUsd(usage?.estimatedCostUsd ?? 0)} / ${limit.toFixed(2)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                costPct >= 90 ? "bg-destructive" : costPct >= 70 ? "bg-amber-500" : "bg-primary"
              )}
              style={{ width: `${costPct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {quota?.quota?.hardStop ? "Hard stop aktif — limit aşılırsa LLM çağrıları engellenir." : "Uyarı eşiği: %80"}
          </p>
        </div>
      )}
      {!limit && (
        <p className="text-xs text-muted-foreground">
          Proje kotası tanımlı değil. Ayarlar → Kullanım kotası bölümünden limit belirleyebilirsin.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">Proje: {projectId}</p>
    </div>
  );
}

export function UsagePage() {
  const qc = useQueryClient();
  const presets = usageRangePresets();
  const projectId = getProjectId();
  const [rangeKey, setRangeKey] = useState<"d7" | "d30" | "d90">("d7");
  const [groupBy, setGroupBy] = useState<UsageGroupBy>("tool");
  const [filterByProject, setFilterByProject] = useState(false);
  const [eventsPage, setEventsPage] = useState(0);

  const range = presets[rangeKey];
  const days = rangeKey === "d7" ? 7 : rangeKey === "d30" ? 30 : 90;

  const statsQuery = useQuery({
    queryKey: ["usage-stats", days],
    queryFn: () => fetchUsageStats(days),
    staleTime: 30_000,
  });

  const summaryQuery = useQuery({
    queryKey: ["usage-summary", rangeKey, groupBy],
    queryFn: () => fetchUsageSummary({ from: range.from, to: range.to, groupBy }),
    staleTime: 30_000,
  });

  const daySummaryQuery = useQuery({
    queryKey: ["usage-summary-day", rangeKey],
    queryFn: () => fetchUsageSummary({ from: range.from, to: range.to, groupBy: "day" }),
    staleTime: 30_000,
  });

  const quotaQuery = useQuery({
    queryKey: ["quota-check", projectId],
    queryFn: () => checkProjectQuota(projectId),
    staleTime: 60_000,
  });

  const eventsQuery = useQuery({
    queryKey: ["usage-events", rangeKey, filterByProject ? projectId : null, eventsPage],
    queryFn: () =>
      fetchUsageEvents({
        from: range.from,
        to: range.to,
        limit: EVENTS_PAGE_SIZE,
        offset: eventsPage * EVENTS_PAGE_SIZE,
        projectId: filterByProject ? projectId : undefined,
      }),
    staleTime: 30_000,
  });

  const anomaliesQuery = useQuery({
    queryKey: ["usage-anomalies", projectId],
    queryFn: () => fetchCostAnomalies(projectId, days),
    staleTime: 60_000,
  });

  const totals = useMemo(() => {
    const groups = summaryQuery.data?.groups ?? [];
    return groups.reduce(
      (acc, g) => ({
        callCount: acc.callCount + g.callCount,
        promptTokens: acc.promptTokens + g.promptTokens,
        completionTokens: acc.completionTokens + g.completionTokens,
        totalTokens: acc.totalTokens + g.totalTokens,
        estimatedCostUsd: acc.estimatedCostUsd + g.estimatedCostUsd,
      }),
      { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 }
    );
  }, [summaryQuery.data]);

  const maxTokens = Math.max(...(summaryQuery.data?.groups?.map((g) => g.totalTokens) ?? [1]), 1);
  const avgTokensPerCall = totals.callCount ? Math.round(totals.totalTokens / totals.callCount) : 0;
  const avgCostPerCall = totals.callCount ? totals.estimatedCostUsd / totals.callCount : 0;
  const eventsTotal = eventsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(eventsTotal / EVENTS_PAGE_SIZE));

  const refresh = () => {
    void qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("usage") });
    void qc.invalidateQueries({ queryKey: ["quota-check"] });
    void qc.invalidateQueries({ queryKey: ["usage-anomalies"] });
  };

  return (
    <OpsPageShell className="max-w-[min(100%,1680px)]">
      <OpsPageHero
        icon={Coins}
        title="Token Kullanımı"
        description="LLM ve embedding çağrılarının maliyet, token ve araç bazlı dökümü. Günlük trend, kota durumu ve çağrı geçmişi tek ekranda."
        actions={
          <Button variant="outline" size="sm" className="rounded-xl" onClick={refresh}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Yenile
          </Button>
        }
      />

      <OpsToolbar>
        {(["d7", "d30", "d90"] as const).map((key) => (
          <OpsPill key={key} active={rangeKey === key} onClick={() => { setRangeKey(key); setEventsPage(0); }}>
            {presets[key].label}
          </OpsPill>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-border/60 sm:inline" />
        <OpsPill active={!filterByProject} onClick={() => { setFilterByProject(false); setEventsPage(0); }}>
          Tüm projeler
        </OpsPill>
        <OpsPill active={filterByProject} onClick={() => { setFilterByProject(true); setEventsPage(0); }}>
          Proje: {projectId}
        </OpsPill>
      </OpsToolbar>

      {anomaliesQuery.data?.hasAnomalies && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-500/15 p-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="space-y-1.5 text-sm">
              <p className="font-semibold text-amber-700 dark:text-amber-400">Maliyet anomalisi tespit edildi</p>
              {(anomaliesQuery.data.anomalies as Array<{ message?: string }>).map((a, i) => (
                <p key={i} className="text-muted-foreground">{a.message}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      <OpsStatGrid className="lg:grid-cols-3 xl:grid-cols-6">
        {summaryQuery.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-2xl" />)
        ) : (
          <>
            <OpsStatCard
              label="Toplam token"
              value={formatTokenCount(totals.totalTokens)}
              hint={`${presets[rangeKey].label} aralığı`}
              icon={Hash}
              delay={0.05}
            />
            <OpsStatCard
              label="Prompt token"
              value={formatTokenCount(totals.promptTokens)}
              hint={`${pct(totals.promptTokens, totals.totalTokens)}% pay`}
              icon={ArrowUpRight}
              delay={0.08}
            />
            <OpsStatCard
              label="Completion token"
              value={formatTokenCount(totals.completionTokens)}
              hint={`${pct(totals.completionTokens, totals.totalTokens)}% pay`}
              icon={ArrowDownLeft}
              delay={0.11}
            />
            <OpsStatCard
              label="Tahmini maliyet"
              value={formatCostUsd(totals.estimatedCostUsd)}
              hint={statsQuery.data ? `7g istatistik: ${formatCostUsd(statsQuery.data.estimatedCostUsd)}` : undefined}
              icon={Coins}
              tone="warning"
              delay={0.14}
            />
            <OpsStatCard
              label="Çağrı sayısı"
              value={totals.callCount.toLocaleString("tr-TR")}
              hint={`Ort. ${formatTokenCount(avgTokensPerCall)} token/çağrı`}
              icon={Layers}
              delay={0.17}
            />
            <OpsStatCard
              label="Ort. maliyet / çağrı"
              value={formatCostUsd(avgCostPerCall)}
              hint={totals.callCount ? `${totals.callCount} işlem üzerinden` : "Henüz çağrı yok"}
              icon={TrendingUp}
              delay={0.2}
            />
          </>
        )}
      </OpsStatGrid>

      <div className="grid gap-6 xl:grid-cols-3">
        <OpsPanel
          className="xl:col-span-2"
          title="Günlük trend"
          description="Seçili aralıktaki token hacmi — gün bazında"
          icon={BarChart3}
        >
          {daySummaryQuery.isLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : (
            <DailyTrendChart groups={daySummaryQuery.data?.groups ?? []} />
          )}
        </OpsPanel>

        <OpsPanel title="Kota durumu" description="Aylık proje limiti ve mevcut kullanım" icon={Gauge}>
          <QuotaPanel projectId={projectId} loading={quotaQuery.isLoading} quota={quotaQuery.data} />
        </OpsPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <OpsPanel
          className="xl:col-span-3"
          title={`${GROUP_LABELS[groupBy]} kırılımı`}
          description="Token, maliyet ve prompt/completion dağılımı"
          icon={Sparkles}
          actions={
            <div className="flex flex-wrap gap-1">
              {(Object.keys(GROUP_LABELS) as UsageGroupBy[]).map((key) => (
                <OpsPill key={key} active={groupBy === key} onClick={() => setGroupBy(key)}>
                  {GROUP_LABELS[key]}
                </OpsPill>
              ))}
            </div>
          }
        >
          {summaryQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : summaryQuery.data?.groups?.length ? (
            <div className="space-y-3">
              {summaryQuery.data.groups.map((g, i) => (
                <BreakdownRow key={g.key} group={g} maxTokens={maxTokens} rank={i + 1} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <Zap className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">Bu aralıkta kayıt yok</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Sohbet veya araç çağrısı yaptığında kullanım burada görünür.
              </p>
            </div>
          )}
        </OpsPanel>

        <OpsPanel
          className="xl:col-span-2"
          title="En çok kullanılan araçlar"
          description={`Son ${days} gün — hızlı özet`}
          icon={Zap}
        >
          {statsQuery.isLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : statsQuery.data?.byTool?.length ? (
            <ul className="space-y-2">
              {statsQuery.data.byTool.slice(0, 8).map((t, i) => (
                <li
                  key={t.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/40 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-[10px] font-semibold text-muted-foreground">{i + 1}</span>
                    <span className="truncate font-mono text-xs">{t.key}</span>
                  </div>
                  <div className="shrink-0 text-right text-xs tabular-nums">
                    <p className="font-medium">{formatTokenCount(t.totalTokens)}</p>
                    <p className="text-muted-foreground">{t.callCount} çağrı</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Araç istatistiği henüz yok.</p>
          )}
        </OpsPanel>
      </div>

      <OpsPanel
        title="Çağrı geçmişi"
        description={`${eventsTotal.toLocaleString("tr-TR")} kayıt · sayfa ${eventsPage + 1}/${totalPages}`}
        icon={Layers}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={eventsPage === 0 || eventsQuery.isFetching}
              onClick={() => setEventsPage((p) => Math.max(0, p - 1))}
            >
              Önceki
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={eventsPage >= totalPages - 1 || eventsQuery.isFetching}
              onClick={() => setEventsPage((p) => p + 1)}
            >
              Sonraki
            </Button>
          </div>
        }
        noPadding
      >
        {eventsQuery.isLoading ? (
          <div className="p-5 sm:p-6">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : eventsQuery.data?.events?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Zaman</th>
                  <th className="px-3 py-3 font-medium">Araç</th>
                  <th className="px-3 py-3 font-medium">Model</th>
                  <th className="px-3 py-3 font-medium">Kaynak</th>
                  <th className="px-3 py-3 font-medium">Plugin</th>
                  <th className="px-3 py-3 text-right font-medium">Prompt</th>
                  <th className="px-3 py-3 text-right font-medium">Completion</th>
                  <th className="px-3 py-3 text-right font-medium">Toplam</th>
                  <th className="px-5 py-3 text-right font-medium">Maliyet</th>
                </tr>
              </thead>
              <tbody>
                {eventsQuery.data.events.map((e) => (
                  <tr key={e.id} className="border-b border-border/30 transition-colors hover:bg-muted/15">
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">
                      {formatTime(e.occurredAt)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className="max-w-[140px] truncate font-mono text-[10px]">
                        {e.toolName || e.operationType}
                      </Badge>
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-3 text-xs">{e.model || "—"}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{e.source || "—"}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{e.pluginName || "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-xs">{formatTokenCount(e.promptTokens)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-xs">
                      {formatTokenCount(e.completionTokens)}
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">
                      {formatTokenCount(e.totalTokens)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-xs">
                      {e.estimatedCostUsd != null ? formatCostUsd(e.estimatedCostUsd) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Layers className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Henüz çağrı kaydı yok.</p>
          </div>
        )}
      </OpsPanel>
    </OpsPageShell>
  );
}
