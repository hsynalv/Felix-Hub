import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  FlaskConical,
  GitCompare,
  Layers,
  Play,
  RefreshCw,
  Target,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  OpsHelpPanel,
  OpsPageHero,
  OpsPageShell,
  OpsPanel,
  OpsStatCard,
  OpsStatGrid,
} from "@/components/ops/OpsPrimitives";
import { cn } from "@/lib/utils";
import {
  evalGoldenTrace,
  fetchGoldenTraces,
  runRegressionSuite,
  runPromptEvalSuite,
  type GoldenTrace,
  type PromptEvalSuite,
  type RegressionResult,
  type TemplateEvalResult,
} from "@/lib/eval-api";
import { useToast } from "@/providers/ToastProvider";

function PassRateRing({ passed, total }: { passed: number; total: number }) {
  const rate = total ? Math.round((passed / total) * 100) : 0;
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (rate / 100) * circumference;

  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg className="-rotate-90" width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="36" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle
          cx="48"
          cy="48"
          r="36"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(rate === 100 ? "text-success" : rate >= 70 ? "text-primary" : "text-destructive")}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-lg font-bold tabular-nums">{rate}%</p>
        <p className="text-[9px] text-muted-foreground">geçti</p>
      </div>
    </div>
  );
}

function GoldenTraceCard({
  trace,
  selected,
  result,
  onSelect,
  onEval,
  evaluating,
}: {
  trace: GoldenTrace;
  selected: boolean;
  result?: TemplateEvalResult;
  onSelect: () => void;
  onEval: () => void;
  evaluating: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-all",
        selected
          ? "border-primary/50 bg-primary/8 shadow-sm shadow-primary/10"
          : "border-border/50 bg-background/30 hover:border-border hover:bg-muted/20"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-semibold">{trace.id}</p>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{trace.goal || "Hedef tanımlı değil"}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {trace.templateId}
            </Badge>
            <Badge variant="default" className="text-[10px]">
              {trace.stepCount} adım
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {result && (
            <Badge variant={result.pass ? "success" : "destructive"} className="text-[10px]">
              {result.pass ? "PASS" : "FAIL"}
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-lg text-xs"
            disabled={evaluating}
            onClick={(e) => {
              e.stopPropagation();
              onEval();
            }}
          >
            <Play className="mr-1 h-3 w-3" />
            Eval
          </Button>
        </div>
      </div>
    </button>
  );
}

function TraceDetailPanel({
  trace,
  result,
  onEval,
  evaluating,
}: {
  trace: GoldenTrace | null;
  result?: TemplateEvalResult;
  onEval: () => void;
  evaluating: boolean;
}) {
  if (!trace) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <Target className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium">Bir golden trace seç</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Soldaki listeden bir senaryo seçerek beklenen adımlarla üretilen planı karşılaştır.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-lg font-semibold">{trace.id}</h3>
          {trace.goal && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{trace.goal}</p>}
        </div>
        <Button size="sm" disabled={evaluating} onClick={onEval}>
          <Play className="mr-1.5 h-3.5 w-3.5" />
          Eval çalıştır
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-background/40 p-4">
          <p className="text-xs text-muted-foreground">Template</p>
          <p className="mt-1 font-mono text-sm font-medium">{trace.templateId}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-background/40 p-4">
          <p className="text-xs text-muted-foreground">Beklenen adım</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{trace.stepCount}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-background/40 p-4">
          <p className="text-xs text-muted-foreground">Dosya</p>
          <p className="mt-1 truncate font-mono text-xs">{trace.file || "—"}</p>
        </div>
      </div>

      {result ? (
        <div
          className={cn(
            "rounded-2xl border p-5",
            result.pass ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
          )}
        >
          <div className="flex items-center gap-3">
            {result.pass ? (
              <CheckCircle2 className="h-6 w-6 text-success" />
            ) : (
              <XCircle className="h-6 w-6 text-destructive" />
            )}
            <div>
              <p className="font-semibold">{result.pass ? "Golden ile uyumlu" : "Uyumsuzluk tespit edildi"}</p>
              <p className="text-xs text-muted-foreground">
                {result.comparison
                  ? `Beklenen ${result.comparison.expectedCount} adım · Üretilen ${result.comparison.actualCount} adım`
                  : "Karşılaştırma tamamlandı"}
              </p>
            </div>
          </div>

          {result.plan?.tools?.length ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Üretilen plan sırası</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {result.plan.tools.map((tool, i) => (
                  <span key={`${tool}-${i}`} className="flex items-center gap-1.5">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {tool}
                    </Badge>
                    {i < result.plan!.tools.length - 1 && (
                      <span className="text-muted-foreground">→</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {result.comparison?.diffs?.length ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-destructive">
                {result.comparison.diffs.length} fark bulundu
              </p>
              <pre className="max-h-56 overflow-auto rounded-xl border border-border/50 bg-muted/20 p-3 font-mono text-[11px] leading-relaxed">
                {JSON.stringify(result.comparison.diffs, null, 2)}
              </pre>
            </div>
          ) : result.pass ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Template planı golden adımlarla birebir uyumlu.
            </p>
          ) : null}

          {result.error?.message && (
            <p className="mt-3 text-sm text-destructive">{result.error.message}</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
          Henüz eval çalıştırılmadı. Yukarıdaki butonla karşılaştırmayı başlat.
        </div>
      )}
    </div>
  );
}

function PromptEvalMatrix({ data }: { data: PromptEvalSuite }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-6">
        <PassRateRing passed={data.summary.passed} total={data.summary.variants} />
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {data.pass ? "Tüm variantlar geçti" : `${data.summary.failed} variant başarısız`}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.summary.passed}/{data.summary.variants} variant · {data.metrics.length} metrik
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/20 text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Variant</th>
              {data.metrics.map((m) => (
                <th key={m} className="px-3 py-3 font-medium">
                  {m}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium">Skor</th>
              <th className="px-4 py-3 text-right font-medium">Durum</th>
            </tr>
          </thead>
          <tbody>
            {data.variants.map((v) => {
              const pct = v.max ? Math.round((v.total / v.max) * 100) : 0;
              return (
                <tr key={v.variantId} className="border-b border-border/30 hover:bg-muted/10">
                  <td className="px-4 py-3">
                    <p className="font-medium">{v.label}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{v.variantId}</p>
                  </td>
                  {data.metrics.map((m) => (
                    <td key={m} className="px-3 py-3 text-center">
                      {v.scores[m] ? (
                        <CheckCircle2 className="inline h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="inline h-4 w-4 text-destructive/70" />
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">
                        {v.total}/{v.max}
                      </span>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", v.pass ? "bg-success" : "bg-destructive/70")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge variant={v.pass ? "success" : "destructive"} className="text-[10px]">
                      {v.pass ? "PASS" : "FAIL"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RegressionReport({ data }: { data: RegressionResult }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-6">
        <PassRateRing passed={data.summary.passed} total={data.summary.total} />
        <OpsStatGrid className="flex-1 lg:grid-cols-3">
          <OpsStatCard label="Toplam" value={data.summary.total} icon={Layers} />
          <OpsStatCard
            label="Geçti"
            value={data.summary.passed}
            icon={CheckCircle2}
            tone="success"
            delay={0.05}
          />
          <OpsStatCard
            label="Başarısız"
            value={data.summary.failed}
            icon={XCircle}
            tone={data.summary.failed > 0 ? "danger" : "default"}
            delay={0.1}
          />
        </OpsStatGrid>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.results.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className={cn(
              "rounded-xl border p-4",
              r.pass ? "border-success/25 bg-success/5" : "border-destructive/25 bg-destructive/5"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-semibold">{r.id}</p>
                <Badge variant="outline" className="mt-1.5 text-[10px]">
                  {r.templateId}
                </Badge>
              </div>
              {r.pass ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-destructive" />
              )}
            </div>
            {!r.pass && r.diffs?.length > 0 && (
              <p className="mt-2 text-[11px] text-destructive">{r.diffs.length} fark</p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function EvalStudioPage() {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [evalResults, setEvalResults] = useState<Record<string, TemplateEvalResult>>({});
  const [promptEval, setPromptEval] = useState<PromptEvalSuite | null>(null);

  const tracesQuery = useQuery({
    queryKey: ["eval-golden"],
    queryFn: fetchGoldenTraces,
  });

  const regressionMutation = useMutation({
    mutationFn: runRegressionSuite,
    onSuccess: (data) => {
      toast.show(
        data.pass
          ? `Regression geçti (${data.summary.passed}/${data.summary.total})`
          : `Regression başarısız (${data.summary.failed} hata)`,
        data.pass ? undefined : "error"
      );
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const evalMutation = useMutation({
    mutationFn: (goldenId: string) => evalGoldenTrace(goldenId),
    onSuccess: (data, goldenId) => {
      setEvalResults((prev) => ({ ...prev, [goldenId]: data }));
      toast.show(
        data.pass ? `${goldenId}: geçti` : `${goldenId}: başarısız (${data.comparison?.diffs?.length ?? 0} fark)`,
        data.pass ? undefined : "error"
      );
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const promptEvalMutation = useMutation({
    mutationFn: runPromptEvalSuite,
    onSuccess: (data) => {
      setPromptEval(data);
      toast.show(
        data.pass
          ? `Prompt eval geçti (${data.summary.passed}/${data.summary.variants})`
          : `Prompt eval: ${data.summary.failed} variant başarısız`,
        data.pass ? undefined : "error"
      );
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const traces = tracesQuery.data?.traces ?? [];
  const selected = traces.find((t) => t.id === selectedId) ?? traces[0] ?? null;
  const selectedResult = selected ? evalResults[selected.id] : undefined;

  const evalStats = useMemo(() => {
    const evaluated = Object.values(evalResults);
    return {
      evaluated: evaluated.length,
      passed: evaluated.filter((r) => r.pass).length,
    };
  }, [evalResults]);

  return (
    <OpsPageShell className="max-w-[min(100%,1680px)]">
      <OpsPageHero
        icon={FlaskConical}
        title="Eval Studio"
        description="Golden trace regression, prompt variant testleri ve agent kalite ölçümü. Beklenen tool sırasının hâlâ doğru olduğunu doğrula."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => tracesQuery.refetch()}
              disabled={tracesQuery.isFetching}
            >
              <RefreshCw className={cn("mr-1.5 h-4 w-4", tracesQuery.isFetching && "animate-spin")} />
              Yenile
            </Button>
            <Button
              size="sm"
              className="rounded-xl"
              disabled={regressionMutation.isPending}
              onClick={() => regressionMutation.mutate()}
            >
              <GitCompare className="mr-1.5 h-4 w-4" />
              Regression
            </Button>
          </div>
        }
      />

      <OpsStatGrid>
        <OpsStatCard
          label="Golden trace"
          value={traces.length}
          hint="eval/golden/ referans senaryoları"
          icon={Target}
          delay={0.05}
        />
        <OpsStatCard
          label="Eval çalıştırılan"
          value={evalStats.evaluated}
          hint={evalStats.evaluated ? `${evalStats.passed} geçti` : "Henüz eval yok"}
          icon={FlaskConical}
          tone={evalStats.evaluated && evalStats.passed === evalStats.evaluated ? "success" : "default"}
          delay={0.1}
        />
        <OpsStatCard
          label="Son regression"
          value={
            regressionMutation.data
              ? `${regressionMutation.data.summary.passed}/${regressionMutation.data.summary.total}`
              : "—"
          }
          hint={regressionMutation.data ? (regressionMutation.data.pass ? "Geçti" : "Başarısız") : "Henüz çalıştırılmadı"}
          icon={GitCompare}
          tone={regressionMutation.data?.pass ? "success" : regressionMutation.data ? "danger" : "default"}
          delay={0.15}
        />
        <OpsStatCard
          label="Prompt eval"
          value={promptEval ? `${promptEval.summary.passed}/${promptEval.summary.variants}` : "—"}
          hint={promptEval ? (promptEval.pass ? "Tümü geçti" : `${promptEval.summary.failed} fail`) : "Prompts sekmesinden çalıştır"}
          icon={Layers}
          tone={promptEval?.pass ? "success" : promptEval ? "warning" : "default"}
          delay={0.2}
        />
      </OpsStatGrid>

      <Tabs defaultValue="golden" className="w-full">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl border border-border/50 bg-muted/20 p-1.5">
          <TabsTrigger value="golden" className="rounded-xl px-4 py-2">
            Golden traces
          </TabsTrigger>
          <TabsTrigger value="prompts" className="rounded-xl px-4 py-2">
            Prompt eval
          </TabsTrigger>
          <TabsTrigger value="regression" className="rounded-xl px-4 py-2">
            Regression
          </TabsTrigger>
          <TabsTrigger value="help" className="rounded-xl px-4 py-2">
            Rehber
          </TabsTrigger>
        </TabsList>

        <TabsContent value="golden" className="mt-6">
          <div className="grid gap-6 xl:grid-cols-5">
            <OpsPanel className="xl:col-span-2" title="Senaryolar" description={`${traces.length} golden trace`} icon={Target}>
              {tracesQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                  ))}
                </div>
              ) : tracesQuery.isError ? (
                <p className="text-sm text-destructive">
                  Yüklenemedi: {(tracesQuery.error as Error).message}
                </p>
              ) : traces.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <p>Golden trace bulunamadı.</p>
                  <p className="mt-2 text-xs">
                    <code>eval/golden/*.json</code> dosyalarını commit et ve sunucuyu yeniden başlat.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {traces.map((t) => (
                    <GoldenTraceCard
                      key={t.id}
                      trace={t}
                      selected={selected?.id === t.id}
                      result={evalResults[t.id]}
                      onSelect={() => setSelectedId(t.id)}
                      onEval={() => evalMutation.mutate(t.id)}
                      evaluating={evalMutation.isPending && evalMutation.variables === t.id}
                    />
                  ))}
                </div>
              )}
            </OpsPanel>

            <OpsPanel
              className="xl:col-span-3"
              title="Detay & karşılaştırma"
              description="Seçili trace için plan vs golden adımlar"
              icon={GitCompare}
            >
              <TraceDetailPanel
                trace={selected}
                result={selectedResult}
                evaluating={evalMutation.isPending}
                onEval={() => selected && evalMutation.mutate(selected.id)}
              />
            </OpsPanel>
          </div>
        </TabsContent>

        <TabsContent value="prompts" className="mt-6">
          <OpsPanel
            title="Prompt variant matrix"
            description="Heuristic smoke — tool decision tree, agent loop, mode overlay, spec artifact shape"
            icon={Layers}
            actions={
              <Button size="sm" disabled={promptEvalMutation.isPending} onClick={() => promptEvalMutation.mutate()}>
                <Play className="mr-1.5 h-3.5 w-3.5" />
                Prompt eval çalıştır
              </Button>
            }
          >
            {promptEvalMutation.isPending ? (
              <Skeleton className="h-48 rounded-xl" />
            ) : promptEval ? (
              <PromptEvalMatrix data={promptEval} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                <FlaskConical className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Prompt eval henüz çalıştırılmadı. Butona basarak variant matrisini oluştur.
                </p>
              </div>
            )}
          </OpsPanel>
        </TabsContent>

        <TabsContent value="regression" className="mt-6 space-y-6">
          <OpsPanel
            title="Regression suite"
            description="Tüm golden trace'leri workflow şablonlarıyla tek seferde karşılaştırır"
            icon={GitCompare}
            actions={
              <Button disabled={regressionMutation.isPending} onClick={() => regressionMutation.mutate()}>
                <Play className="mr-1.5 h-4 w-4" />
                Tüm suite'i çalıştır
              </Button>
            }
          >
            {regressionMutation.isPending ? (
              <Skeleton className="h-40 rounded-xl" />
            ) : regressionMutation.data ? (
              <RegressionReport data={regressionMutation.data} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                <GitCompare className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Regression henüz çalıştırılmadı. Tüm golden'ları tek seferde test etmek için butona bas.
                </p>
              </div>
            )}
          </OpsPanel>
        </TabsContent>

        <TabsContent value="help" className="mt-6">
          <OpsHelpPanel>
            <p>
              <strong>Eval Studio</strong> agent kalitesini ölçer — yeni workflow eklemek için değil, beklenen adımların
              hâlâ doğru olduğunu doğrular.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                <p className="text-sm font-semibold">Golden trace</p>
                <p className="mt-1 text-xs">
                  Diskteki referans senaryo. Hangi tool'ların hangi sırayla çağrılması gerektiğini tanımlar.
                </p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                <p className="text-sm font-semibold">Eval</p>
                <p className="mt-1 text-xs">
                  Template'den üretilen plan ile golden adımları karşılaştırır; farkları satır satır gösterir.
                </p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                <p className="text-sm font-semibold">Regression</p>
                <p className="mt-1 text-xs">
                  Tüm golden'ları tek seferde koşar — CI'daki <code>POST /eval/regression</code> ile aynı mantık.
                </p>
              </div>
            </div>
          </OpsHelpPanel>
        </TabsContent>
      </Tabs>
    </OpsPageShell>
  );
}
