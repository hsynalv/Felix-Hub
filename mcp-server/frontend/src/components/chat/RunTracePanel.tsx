import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Bot, CheckCircle2, Clock, Loader2, MessageSquare, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RunStep } from "@/lib/runs-api";
import { cn, formatDuration } from "@/lib/utils";

export interface LiveRunStep {
  id: string;
  type: "llm" | "tool" | "approval" | "system";
  toolName?: string | null;
  status: string;
  phase?: string;
  durationMs?: number | null;
}

function stepIcon(type: string) {
  if (type === "tool") return <Bot className="h-3.5 w-3.5" />;
  if (type === "approval") return <Clock className="h-3.5 w-3.5" />;
  if (type === "llm") return <MessageSquare className="h-3.5 w-3.5" />;
  return <Activity className="h-3.5 w-3.5" />;
}

function toLiveStep(raw: Partial<LiveRunStep> & { step?: RunStep }, index: number): LiveRunStep {
  const step = raw.step;
  return {
    id: raw.id || step?.id || `live-${index}`,
    type: (raw.type || step?.type || "system") as LiveRunStep["type"],
    toolName: raw.toolName ?? step?.toolName,
    status: raw.status || step?.status || "ok",
    phase: raw.phase,
    durationMs: raw.durationMs ?? step?.durationMs,
  };
}

export function RunTracePanel({
  runId,
  steps: initialSteps = [],
  live = false,
  className,
}: {
  runId: string | null;
  steps?: RunStep[];
  live?: boolean;
  className?: string;
}) {
  const [liveSteps, setLiveSteps] = useState<LiveRunStep[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrolledCountRef = useRef(0);

  useEffect(() => {
    setLiveSteps(initialSteps.map((s, i) => toLiveStep({ step: s }, i)));
    lastScrolledCountRef.current = 0;
  }, [initialSteps, runId]);

  const appendLive = useCallback((entry: Partial<LiveRunStep>) => {
    setLiveSteps((prev) => {
      const idx = prev.findIndex(
        (s) =>
          s.type === entry.type &&
          s.toolName === entry.toolName &&
          s.phase === entry.phase &&
          s.status === "pending"
      );
      if (idx >= 0 && entry.phase === "end") {
        const next = [...prev];
        next[idx] = { ...next[idx], ...toLiveStep(entry, idx), status: entry.status || "ok" };
        return next;
      }
      return [...prev, toLiveStep({ ...entry, id: `live-${Date.now()}-${prev.length}` }, prev.length)];
    });
  }, []);

  useEffect(() => {
    if (!live || liveSteps.length === 0) return;
    if (liveSteps.length <= lastScrolledCountRef.current) return;
    lastScrolledCountRef.current = liveSteps.length;
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [liveSteps.length, live]);

  useEffect(() => {
    if (!runId || !live) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.runId !== runId) return;
      appendLive(detail);
    };
    window.addEventListener("mcp-run-step", handler);
    return () => window.removeEventListener("mcp-run-step", handler);
  }, [runId, live, appendLive]);

  if (!runId) {
    return (
      <div className={cn("flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground", className)}>
        Run trace burada görünür
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-medium">
          {live ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <Activity className="h-3.5 w-3.5" />}
          <span className="font-mono">{runId.slice(0, 8)}…</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
          <Link to={`/runs`}>Tümü</Link>
        </Button>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-2">
        <div className="space-y-1.5">
          {liveSteps.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Adım bekleniyor…</p>
          ) : (
            liveSteps.map((step) => {
              const ok = step.status === "ok" || step.status === "pending";
              return (
                <div
                  key={step.id}
                  className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/50 px-2 py-1.5 text-xs"
                >
                  <span className="text-muted-foreground">{stepIcon(step.type)}</span>
                  <Badge variant="default" className="font-mono text-[9px]">
                    {step.type}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate">{step.toolName || "—"}</span>
                  {ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  )}
                  {step.durationMs != null && (
                    <span className="font-mono text-[10px] text-muted-foreground">{formatDuration(step.durationMs)}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function dispatchRunStepEvent(detail: {
  runId: string;
  type?: string;
  toolName?: string;
  phase?: string;
  status?: string;
}) {
  window.dispatchEvent(new CustomEvent("mcp-run-step", { detail }));
}
