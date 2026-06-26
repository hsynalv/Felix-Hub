import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, FlaskConical, Play, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OpsHelpPanel, OpsPageHero, OpsPageShell, OpsPanel } from "@/components/ops/OpsPrimitives";
import {
  evalGoldenTrace,
  fetchGoldenTraces,
  runRegressionSuite,
  type GoldenTrace,
  type TemplateEvalResult,
} from "@/lib/eval-api";
import { useToast } from "@/providers/ToastProvider";

export function EvalStudioPage() {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [evalResults, setEvalResults] = useState<Record<string, TemplateEvalResult>>({});

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

  const traces = tracesQuery.data?.traces ?? [];
  const selected = traces.find((t) => t.id === selectedId) ?? traces[0] ?? null;
  const selectedResult = selected ? evalResults[selected.id] : undefined;

  return (
    <OpsPageShell>
      <OpsPageHero
        icon={FlaskConical}
        title="Eval Studio"
        description="Golden trace regression, workflow karşılaştırma ve agent kalite ölçümü"
      />

      <Tabs defaultValue="golden" className="mt-6">
        <TabsList equalWidth>
          <TabsTrigger value="golden">Golden traces</TabsTrigger>
          <TabsTrigger value="regression">Regression</TabsTrigger>
          <TabsTrigger value="help">Rehber</TabsTrigger>
        </TabsList>

        <TabsContent value="golden" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Golden traces</CardTitle>
              </CardHeader>
              <CardContent>
                {tracesQuery.isLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : tracesQuery.isError ? (
                  <p className="text-sm text-destructive">
                    Yüklenemedi: {(tracesQuery.error as Error).message}. Giriş yap ve API’nin 8787’de çalıştığından emin ol.
                  </p>
                ) : traces.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Repo’da <code className="text-xs">eval/golden/*.json</code> dosyaları varsa sunucu bunları listeler.
                    UI’dan yeni golden eklenemez — dosya veya API ile tanımlanır.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {traces.map((t) => (
                      <GoldenRow
                        key={t.id}
                        trace={t}
                        selected={selected?.id === t.id}
                        result={evalResults[t.id]}
                        onSelect={() => setSelectedId(t.id)}
                        onEval={() => evalMutation.mutate(t.id)}
                        evaluating={evalMutation.isPending && evalMutation.variables === t.id}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Seçili trace</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!selected ? (
                  <p className="text-muted-foreground">Soldan bir trace seç veya regression sekmesine geç.</p>
                ) : (
                  <>
                    <p>
                      <span className="text-muted-foreground">Template:</span>{" "}
                      <Badge variant="outline">{selected.templateId}</Badge>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Adım:</span> {selected.stepCount}
                    </p>
                    {selected.goal && (
                      <p className="text-muted-foreground">{selected.goal}</p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={evalMutation.isPending}
                      onClick={() => selected && evalMutation.mutate(selected.id)}
                    >
                      Bu trace için eval çalıştır
                    </Button>
                    {selectedResult && (
                      <div className="rounded-lg border border-border/50 p-3">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{selectedResult.pass ? "Geçti" : "Başarısız"}</p>
                          <Badge variant={selectedResult.pass ? "success" : "destructive"}>
                            {selectedResult.pass ? "PASS" : "FAIL"}
                          </Badge>
                        </div>
                        {selectedResult.plan?.tools?.length ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Plan: {selectedResult.plan.tools.join(" → ")}
                          </p>
                        ) : null}
                        {selectedResult.comparison?.diffs?.length ? (
                          <pre className="mt-2 max-h-48 overflow-auto text-xs text-muted-foreground">
                            {JSON.stringify(selectedResult.comparison.diffs, null, 2)}
                          </pre>
                        ) : selectedResult.pass ? (
                          <p className="mt-2 text-xs text-muted-foreground">Golden adımlarla template planı uyumlu.</p>
                        ) : null}
                        {selectedResult.error?.message && (
                          <p className="mt-2 text-xs text-destructive">{selectedResult.error.message}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="regression" className="mt-4 space-y-4">
          <OpsPanel title="Regression suite">
            <p className="mb-3 text-sm text-muted-foreground">
              Tüm golden trace’leri workflow şablonlarıyla karşılaştırır. Sonuç aşağıda görünür; ilk kullanımda butona bas.
            </p>
            <Button disabled={regressionMutation.isPending} onClick={() => regressionMutation.mutate()}>
              <Play className="mr-1.5 h-4 w-4" />
              Tüm regression suite
            </Button>
          </OpsPanel>

          {regressionMutation.data && (
            <OpsPanel title="Son regression raporu">
              <div className="flex flex-wrap gap-3 text-sm">
                <Stat label="Toplam" value={regressionMutation.data.summary.total} />
                <Stat label="Geçti" value={regressionMutation.data.summary.passed} ok />
                <Stat
                  label="Başarısız"
                  value={regressionMutation.data.summary.failed}
                  fail={regressionMutation.data.summary.failed > 0}
                />
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {regressionMutation.data.results.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    {r.pass ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span className="font-mono text-xs">{r.id}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {r.templateId}
                    </Badge>
                  </li>
                ))}
              </ul>
            </OpsPanel>
          )}
        </TabsContent>

        <TabsContent value="help" className="mt-4">
          <OpsHelpPanel>
            <p>
              <strong>Eval Studio</strong> agent kalitesini ölçer — yeni workflow veya run eklemek için değil, beklenen adımların hâlâ doğru olduğunu doğrular.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Golden trace:</strong> Diskteki referans senaryo (<code className="text-xs">eval/golden/</code>). Örn. CI fix akışında hangi tool’ların sırayla çağrılması gerektiği.
              </li>
              <li>
                <strong>Eval:</strong> Seçili trace’in template’inden üretilen plan ile golden adımları karşılaştırır.
              </li>
              <li>
                <strong>Regression suite:</strong> Tüm golden’ları tek seferde koşar — CI’da <code className="text-xs">POST /eval/regression</code> ile aynı mantık.
              </li>
            </ul>
            <p className="text-xs">
              Liste boşsa: API erişimi (auth), sunucu restart veya <code className="text-xs">eval/golden</code> klasörü kontrol et.
              Golden dosyası UI’dan eklenmez; JSON dosyası commit edilir.
            </p>
          </OpsHelpPanel>
        </TabsContent>
      </Tabs>
    </OpsPageShell>
  );
}

function GoldenRow({
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
    <li
      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${selected ? "border-primary/40 bg-primary/5" : "border-border/50"}`}
    >
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
        <p className="truncate font-medium">{trace.id}</p>
        <p className="text-xs text-muted-foreground">
          {trace.templateId} · {trace.stepCount} adım
        </p>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        {result && (
          <Badge variant={result.pass ? "success" : "destructive"} className="text-[10px]">
            {result.pass ? "Geçti" : "Kaldı"}
          </Badge>
        )}
        <Button size="sm" variant="outline" disabled={evaluating} onClick={onEval}>
          Eval
        </Button>
      </div>
    </li>
  );
}

function Stat({ label, value, ok, fail }: { label: string; value: number; ok?: boolean; fail?: boolean }) {
  return (
    <div className="rounded-lg border border-border/50 px-3 py-2">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums ${ok ? "text-success" : ""} ${fail ? "text-destructive" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
