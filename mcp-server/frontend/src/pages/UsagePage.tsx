import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Coins, Hash, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";
import {
  fetchUsageEvents,
  fetchUsageSummary,
  fetchProjectUsage,
  formatCostUsd,
  formatTokenCount,
  usageRangePresets,
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

export function UsagePage() {
  const presets = usageRangePresets();
  const projectId = getProjectId();
  const [rangeKey, setRangeKey] = useState<"d7" | "d30" | "d90">("d7");
  const [groupBy, setGroupBy] = useState<UsageGroupBy>("tool");
  const [filterByProject, setFilterByProject] = useState(true);

  const range = presets[rangeKey];

  const projectUsageQuery = useQuery({
    queryKey: ["usage-project", projectId, rangeKey],
    queryFn: () => fetchProjectUsage(projectId, rangeKey === "d7" ? 7 : rangeKey === "d30" ? 30 : 90),
    enabled: filterByProject && !!projectId,
    staleTime: 30_000,
  });

  const summaryQuery = useQuery({
    queryKey: ["usage-summary", rangeKey, groupBy, filterByProject ? projectId : null],
    queryFn: () =>
      fetchUsageSummary({
        from: range.from,
        to: range.to,
        groupBy,
      }),
    staleTime: 30_000,
  });

  const eventsQuery = useQuery({
    queryKey: ["usage-events", rangeKey, filterByProject ? projectId : null],
    queryFn: () =>
      fetchUsageEvents({
        from: range.from,
        to: range.to,
        limit: 30,
        projectId: filterByProject ? projectId : undefined,
      }),
    staleTime: 30_000,
  });

  const totals = useMemo(() => {
    const groups = summaryQuery.data?.groups ?? [];
    return groups.reduce(
      (acc, g) => ({
        callCount: acc.callCount + g.callCount,
        totalTokens: acc.totalTokens + g.totalTokens,
        estimatedCostUsd: acc.estimatedCostUsd + g.estimatedCostUsd,
      }),
      { callCount: 0, totalTokens: 0, estimatedCostUsd: 0 }
    );
  }, [summaryQuery.data]);

  const maxTokens = Math.max(...(summaryQuery.data?.groups?.map((g) => g.totalTokens) ?? [1]), 1);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Token Kullanımı"
        description="LLM ve embedding çağrılarının araç, model ve tarih bazlı dökümü."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={filterByProject ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setFilterByProject((v) => !v)}
        >
          Proje: {projectId}
        </Button>
        {filterByProject && projectUsageQuery.data?.totals && (
          <Badge variant="default" className="font-mono text-xs">
            {formatCostUsd(projectUsageQuery.data.totals.estimatedCostUsd)} ·{" "}
            {formatTokenCount(projectUsageQuery.data.totals.totalTokens)} tok
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["d7", "d30", "d90"] as const).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={rangeKey === key ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setRangeKey(key)}
          >
            {presets[key].label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(GROUP_LABELS) as UsageGroupBy[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setGroupBy(key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              groupBy === key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:bg-muted/50"
            )}
          >
            {GROUP_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {summaryQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <Hash className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Toplam token</p>
                  <p className="text-2xl font-semibold tabular-nums">{formatTokenCount(totals.totalTokens)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tahmini maliyet</p>
                  <p className="text-2xl font-semibold tabular-nums">{formatCostUsd(totals.estimatedCostUsd)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Çağrı sayısı</p>
                  <p className="text-2xl font-semibold tabular-nums">{totals.callCount.toLocaleString("tr-TR")}</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            {GROUP_LABELS[groupBy]} kırılımı
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {summaryQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : summaryQuery.data?.groups?.length ? (
            summaryQuery.data.groups.map((g) => (
              <div key={g.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{g.key}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatTokenCount(g.totalTokens)} · {g.callCount} çağrı · {formatCostUsd(g.estimatedCostUsd)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-all"
                    style={{ width: `${Math.max(4, (g.totalTokens / maxTokens) * 100)}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Bu aralıkta kayıtlı kullanım yok. Sohbet veya araç çağrısı yaptığında burada görünür.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Son çağrılar</CardTitle>
        </CardHeader>
        <CardContent>
          {eventsQuery.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : eventsQuery.data?.events?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3">Zaman</th>
                    <th className="pb-2 pr-3">Araç</th>
                    <th className="pb-2 pr-3">Model</th>
                    <th className="pb-2 pr-3 text-right">Token</th>
                    <th className="pb-2 text-right">Maliyet</th>
                  </tr>
                </thead>
                <tbody>
                  {eventsQuery.data.events.map((e) => (
                    <tr key={e.id} className="border-b border-border/30">
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {new Date(e.occurredAt).toLocaleString("tr-TR")}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant="default" className="font-mono text-[10px]">
                          {e.toolName || e.operationType}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-xs">{e.model || "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatTokenCount(e.totalTokens)}</td>
                      <td className="py-2 text-right tabular-nums text-xs">
                        {e.estimatedCostUsd != null ? formatCostUsd(e.estimatedCostUsd) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Henüz kayıt yok.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
