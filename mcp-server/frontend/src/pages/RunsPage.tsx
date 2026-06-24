import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Loader2,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  OpsPageHero,
  OpsPageShell,
  OpsPanel,
  OpsStatCard,
  OpsStatGrid,
} from "@/components/ops/OpsPrimitives";
import { getRun, getRunSteps, listRuns, cancelRun, replayRun, listWorkflowTemplates, startWorkflowTemplate, type AgentRun, type RunStep } from "@/lib/runs-api";
import { formatCostUsd } from "@/lib/usage-api";
import { useToast } from "@/providers/ToastProvider";
import { cn, formatDuration, formatTime } from "@/lib/utils";

function statusTone(status?: string) {
  switch (status) {
    case "completed":
      return "bg-success/15 text-success";
    case "failed":
    case "cancelled":
      return "bg-destructive/15 text-destructive";
    case "waiting_approval":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    case "running":
      return "bg-primary/15 text-primary";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function stepIcon(step: RunStep) {
  if (step.type === "tool") return <Bot className="h-4 w-4" />;
  if (step.type === "approval") return <Clock className="h-4 w-4" />;
  if (step.type === "llm") return <MessageSquare className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
}

function RunRow({
  run,
  selected,
  onSelect,
}: {
  run: AgentRun;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
        selected ? "border-primary/50 bg-primary/5" : "border-border/50 bg-background/40 hover:bg-muted/30"
      )}
    >
      <Badge className={cn("shrink-0 font-mono text-[10px]", statusTone(run.status))}>{run.status}</Badge>
      <span className="min-w-0 flex-1 truncate font-medium">{run.goal || "Agent run"}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{run.stepCount ?? 0} adım</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function StepRow({ step, index }: { step: RunStep; index: number }) {
  const [open, setOpen] = useState(false);
  const ok = step.status === "ok" || step.status === "pending";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.2) }}
      className="rounded-xl border border-border/50 bg-background/40"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm"
      >
        <span className="text-muted-foreground">{stepIcon(step)}</span>
        <Badge variant="default" className="font-mono text-[10px]">
          {step.type}
        </Badge>
        <span className="min-w-0 flex-1 truncate">{step.toolName || step.metadata?.model?.toString() || "—"}</span>
        {ok ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
        ) : (
          <XCircle className="h-4 w-4 shrink-0 text-destructive" />
        )}
        {step.durationMs != null && (
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatDuration(step.durationMs)}</span>
        )}
      </button>
      {open && (
        <div className="border-t border-border/40 p-3 text-xs">
          <pre className="max-h-48 overflow-auto rounded-lg bg-muted/30 p-2 font-mono">
            {JSON.stringify({ input: step.input, output: step.output, metadata: step.metadata }, null, 2)}
          </pre>
        </div>
      )}
    </motion.div>
  );
}

export function RunsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();

  const { data: runsData, isLoading } = useQuery({
    queryKey: ["runs", statusFilter],
    queryFn: () =>
      listRuns({
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: 50,
      }),
    refetchInterval: (query) => {
      const runs = query.state.data?.runs ?? [];
      const hasActive = runs.some((r) => r.status === "running" || r.status === "waiting_approval");
      return hasActive ? 3000 : false;
    },
  });

  const runs = runsData?.runs ?? [];

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["run", selectedId],
    queryFn: () => getRun(selectedId!),
    enabled: !!selectedId,
  });

  const { data: stepsData, isLoading: stepsLoading } = useQuery({
    queryKey: ["run-steps", selectedId],
    queryFn: () => getRunSteps(selectedId!),
    enabled: !!selectedId,
    refetchInterval: detail?.status === "running" || detail?.status === "waiting_approval" ? 2000 : false,
  });

  const cancelMutation = useMutation({
    mutationFn: (runId: string) => cancelRun(runId, "user_cancelled"),
    onSuccess: () => {
      toast.show("Run iptal edildi", "info");
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["run", selectedId] });
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const replayMutation = useMutation({
    mutationFn: (runId: string) => replayRun(runId, true),
    onSuccess: (run) => {
      toast.show(`Replay run: ${run.id.slice(0, 8)}…`, "info");
      qc.invalidateQueries({ queryKey: ["runs"] });
      if (run?.id) setSelectedId(run.id);
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const { data: templatesData } = useQuery({
    queryKey: ["workflow-templates"],
    queryFn: listWorkflowTemplates,
  });

  const steps = stepsData?.steps ?? [];

  const runAnalytics = useMemo(() => {
    const toolSteps = steps.filter((s) => s.type === "tool");
    const errors = toolSteps.filter((s) => s.status === "error").length;
    const totalMs = steps.reduce((n, s) => n + (s.durationMs || 0), 0);
    const byPlugin = toolSteps.reduce<Record<string, number>>((acc, s) => {
      const p = (s.toolName || "unknown").split("_")[0];
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {});
    return { toolCount: toolSteps.length, errors, totalMs, byPlugin };
  }, [steps]);

  const exportTrace = () => {
    if (!detail) return;
    const blob = new Blob([JSON.stringify({ run: detail, steps }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `run-${detail.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    const running = runs.filter((r) => r.status === "running").length;
    const waiting = runs.filter((r) => r.status === "waiting_approval").length;
    const done = runs.filter((r) => r.status === "completed").length;
    return { total: runs.length, running, waiting, done };
  }, [runs]);

  return (
    <OpsPageShell>
      <OpsPageHero
        icon={Activity}
        title="Agent Runs"
        description="Çok adımlı agent çalışmaları — tool trace, onay noktaları ve durum timeline."
        actions={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="running">Çalışıyor</SelectItem>
              <SelectItem value="waiting_approval">Onay bekliyor</SelectItem>
              <SelectItem value="completed">Tamamlandı</SelectItem>
              <SelectItem value="failed">Hata</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <OpsStatGrid>
        <OpsStatCard label="Toplam" value={stats.total} icon={Activity} />
        <OpsStatCard label="Aktif" value={stats.running} icon={Loader2} />
        <OpsStatCard label="Onay bekleyen" value={stats.waiting} icon={Clock} />
        <OpsStatCard label="Tamamlanan" value={stats.done} icon={CheckCircle2} />
      </OpsStatGrid>

      {(templatesData?.templates?.length ?? 0) > 0 && (
        <OpsPanel title="Workflow şablonları" description="Tek tıkla çok adımlı run başlat">
          <div className="flex flex-wrap gap-2">
            {templatesData!.templates.map((t) => (
              <Button
                key={t.id}
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const repo = prompt("Repo (owner/name)", "octocat/Hello-World");
                    if (!repo) return;
                    const branch = prompt("Branch", "feature/agent-run");
                    if (!branch) return;
                    const run = await startWorkflowTemplate(t.id, { repo, branch, goal: t.name }, true);
                    toast.show(`Workflow başlatıldı: ${run.id.slice(0, 8)}…`, "info");
                    qc.invalidateQueries({ queryKey: ["runs"] });
                    setSelectedId(run.id);
                  } catch (e) {
                    toast.show(e instanceof Error ? e.message : "Hata", "error");
                  }
                }}
              >
                {t.name} ({t.stepCount} adım)
              </Button>
            ))}
          </div>
        </OpsPanel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <OpsPanel title="Run listesi" className="min-h-[320px]">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Henüz run yok.{" "}
              <Link to="/chat" className="text-primary underline-offset-4 hover:underline">
                Sohbet
              </Link>{" "}
              üzerinden agent çalıştırın.
            </p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  selected={selectedId === run.id}
                  onSelect={() => setSelectedId(run.id)}
                />
              ))}
            </div>
          )}
        </OpsPanel>

        <OpsPanel
          title={detail ? `Run ${detail.id.slice(0, 8)}…` : "Run detayı"}
          description={detail?.goal || "Bir run seçin"}
          className="min-h-[320px]"
        >
          {!selectedId ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Timeline görmek için soldan bir run seçin.</p>
          ) : detailLoading || stepsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge className={cn("font-mono", statusTone(detail?.status))}>{detail?.status}</Badge>
                {detail?.startedAt && <span>Başlangıç: {formatTime(detail.startedAt)}</span>}
                {(detail?.status === "running" || detail?.status === "waiting_approval") && selectedId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(selectedId)}
                  >
                    İptal
                  </Button>
                )}
                {detail?.status === "completed" && selectedId && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={replayMutation.isPending}
                      onClick={() => replayMutation.mutate(selectedId)}
                    >
                      Replay
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={exportTrace}>
                      Export JSON
                    </Button>
                  </>
                )}
                {detail?.conversationId && (
                  <Button variant="ghost" className="h-auto p-0 text-xs" asChild>
                    <Link to={`/chat?c=${detail.conversationId}`}>Sohbete git</Link>
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{runAnalytics.toolCount} tool</span>
                <span>{runAnalytics.errors} hata</span>
                <span>{formatDuration(runAnalytics.totalMs)} toplam</span>
                {detail?.usage?.estimatedCostUsd != null && (
                  <span className="inline-flex items-center gap-1 text-foreground">
                    <Coins className="h-3 w-3" />
                    {formatCostUsd(detail.usage.estimatedCostUsd)}
                    {detail.usage.totalTokens != null && ` · ${detail.usage.totalTokens.toLocaleString()} tok`}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <StepRow key={step.id} step={step} index={i} />
                ))}
              </div>
            </div>
          )}
        </OpsPanel>
      </div>
    </OpsPageShell>
  );
}
