import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, FlaskConical, Play, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OpsPageHero, OpsPageShell, OpsPanel } from "@/components/ops/OpsPrimitives";
import {
  evalTemplate,
  fetchGoldenTraces,
  runRegressionSuite,
  type GoldenTrace,
} from "@/lib/eval-api";
import { useToast } from "@/providers/ToastProvider";

export function EvalStudioPage() {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tracesQuery = useQuery({
    queryKey: ["eval-golden"],
    queryFn: fetchGoldenTraces,
  });

  const regressionMutation = useMutation({
    mutationFn: runRegressionSuite,
    onSuccess: (data) => {
      toast.show(
        data.pass ? `Regression geçti (${data.summary.passed}/${data.summary.total})` : `Regression başarısız (${data.summary.failed} hata)`,
        data.pass ? undefined : "error"
      );
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const evalMutation = useMutation({
    mutationFn: ({ templateId, parameters }: { templateId: string; parameters?: Record<string, unknown> }) =>
      evalTemplate(templateId, parameters || {}),
    onSuccess: (data) => {
      toast.show(data.pass ? "Template eval geçti" : "Template eval başarısız", data.pass ? undefined : "error");
    },
  });

  const traces = tracesQuery.data?.traces ?? [];
  const selected = traces.find((t) => t.id === selectedId) ?? traces[0] ?? null;

  return (
    <OpsPageShell>
      <OpsPageHero
        icon={FlaskConical}
        title="Eval Studio"
        description="Golden trace regression, workflow karşılaştırma ve agent kalite ölçümü"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={regressionMutation.isPending}
          onClick={() => regressionMutation.mutate()}
        >
          <Play className="mr-1.5 h-4 w-4" />
          Tüm regression suite
        </Button>
      </div>

      {regressionMutation.data && (
        <OpsPanel title="Son regression raporu">
          <div className="flex flex-wrap gap-3 text-sm">
            <Stat label="Toplam" value={regressionMutation.data.summary.total} />
            <Stat label="Geçti" value={regressionMutation.data.summary.passed} ok />
            <Stat label="Başarısız" value={regressionMutation.data.summary.failed} fail={regressionMutation.data.summary.failed > 0} />
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {regressionMutation.data.results.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                {r.pass ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                <span className="font-mono text-xs">{r.id}</span>
                <Badge variant="outline" className="text-[10px]">{r.templateId}</Badge>
              </li>
            ))}
          </ul>
        </OpsPanel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Golden traces</CardTitle>
          </CardHeader>
          <CardContent>
            {tracesQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : traces.length === 0 ? (
              <p className="text-sm text-muted-foreground">Golden trace bulunamadı.</p>
            ) : (
              <ul className="space-y-2">
                {traces.map((t) => (
                  <GoldenRow
                    key={t.id}
                    trace={t}
                    selected={selected?.id === t.id}
                    onSelect={() => setSelectedId(t.id)}
                    onEval={() =>
                      evalMutation.mutate({ templateId: t.templateId, parameters: t.parameters as Record<string, unknown> })
                    }
                    evaluating={evalMutation.isPending}
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
              <p className="text-muted-foreground">Bir trace seçin.</p>
            ) : (
              <>
                <p>
                  <span className="text-muted-foreground">Template:</span>{" "}
                  <Badge variant="outline">{selected.templateId}</Badge>
                </p>
                <p>
                  <span className="text-muted-foreground">Adım:</span> {selected.stepCount}
                </p>
                {evalMutation.data && evalMutation.variables?.templateId === selected.templateId && (
                  <div className="rounded-lg border border-border/50 p-3">
                    <p className="font-medium">{evalMutation.data.pass ? "Geçti" : "Başarısız"}</p>
                    {evalMutation.data.comparison?.diffs?.length ? (
                      <pre className="mt-2 max-h-40 overflow-auto text-xs text-muted-foreground">
                        {JSON.stringify(evalMutation.data.comparison.diffs, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </OpsPageShell>
  );
}

function GoldenRow({
  trace,
  selected,
  onSelect,
  onEval,
  evaluating,
}: {
  trace: GoldenTrace;
  selected: boolean;
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
        <p className="text-xs text-muted-foreground">{trace.templateId} · {trace.stepCount} adım</p>
      </button>
      <Button size="sm" variant="outline" disabled={evaluating} onClick={onEval}>
        Eval
      </Button>
    </li>
  );
}

function Stat({ label, value, ok, fail }: { label: string; value: number; ok?: boolean; fail?: boolean }) {
  return (
    <div className="rounded-lg border border-border/50 px-3 py-2">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${ok ? "text-success" : ""} ${fail ? "text-destructive" : ""}`}>
        {value}
      </p>
    </div>
  );
}
