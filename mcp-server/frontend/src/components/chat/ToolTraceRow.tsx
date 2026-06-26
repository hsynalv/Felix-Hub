import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Clock, Loader2, ShieldAlert, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MergedToolCall } from "./chat-message-groups";

export type ToolSummaryPayload = {
  ok?: boolean;
  summary?: string;
  keyFacts?: string[];
  truncated?: boolean;
  rawRef?: { runId?: string; toolName?: string };
};

export type ToolTraceRowProps = {
  tool: MergedToolCall;
  runId?: string | null;
  arguments?: Record<string, unknown>;
  summary?: ToolSummaryPayload | null;
  durationMs?: number | null;
  defaultOpen?: boolean;
};

export function inferToolRisk(name: string): "read" | "write" | "destructive" {
  const n = name.toLowerCase();
  if (n.includes("delete") || n.includes("forget") || n.includes("destroy")) return "destructive";
  if (
    n.startsWith("brain_remember") ||
    n.includes("write") ||
    n.startsWith("shell_") ||
    n.includes("execute")
  ) {
    return "write";
  }
  return "read";
}

function riskBadgeVariant(risk: "read" | "write" | "destructive") {
  if (risk === "destructive") return "destructive" as const;
  if (risk === "write") return "warning" as const;
  return "default" as const;
}

function riskLabel(risk: "read" | "write" | "destructive") {
  if (risk === "destructive") return "destructive";
  if (risk === "write") return "write";
  return "read";
}

function StatusIcon({ status }: { status: MergedToolCall["status"] }) {
  if (status === "running") return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
  if (status === "done") return <Check className="h-3 w-3 text-success" />;
  if (status === "denied") return <X className="h-3 w-3 text-destructive" />;
  if (status === "pending") return <ShieldAlert className="h-3 w-3 text-amber-400" />;
  return <Clock className="h-3 w-3 text-muted-foreground" />;
}

export function ToolTraceRow({
  tool,
  runId,
  arguments: toolArgs,
  summary,
  durationMs,
  defaultOpen = false,
}: ToolTraceRowProps) {
  const [open, setOpen] = useState(defaultOpen);
  const risk = inferToolRisk(tool.name);
  const explanation =
    typeof toolArgs?.explanation === "string" ? toolArgs.explanation : undefined;

  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-background/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
      >
        <StatusIcon status={tool.status} />
        <span className="min-w-0 flex-1 truncate font-mono text-foreground/90">{tool.name}</span>
        <Badge variant={riskBadgeVariant(risk)} className="font-mono text-[9px] uppercase">
          {riskLabel(risk)}
        </Badge>
        {durationMs != null && (
          <span className="font-mono text-[10px] text-muted-foreground">{durationMs}ms</span>
        )}
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border/40"
          >
            <div className="space-y-2 px-3 py-2">
              {explanation && (
                <p className="text-[11px] text-foreground/80">
                  <span className="font-medium text-muted-foreground">Açıklama: </span>
                  {explanation}
                </p>
              )}
              {summary?.summary && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">{summary.summary}</p>
              )}
              {summary?.keyFacts && summary.keyFacts.length > 0 && (
                <ul className="list-inside list-disc text-[10px] text-muted-foreground">
                  {summary.keyFacts.slice(0, 5).map((fact, i) => (
                    <li key={i} className="truncate">
                      {fact}
                    </li>
                  ))}
                </ul>
              )}
              {toolArgs && Object.keys(toolArgs).length > 0 && (
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/30 p-2 font-mono text-[10px] text-muted-foreground">
                  {JSON.stringify(toolArgs, null, 2)}
                </pre>
              )}
              {!summary?.summary && tool.detail && (
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/30 p-2 font-mono text-[10px] text-muted-foreground">
                  {tool.detail}
                </pre>
              )}
              {(runId || summary?.rawRef?.runId) && (
                <Link
                  to={`/runs?highlight=${runId || summary?.rawRef?.runId}`}
                  className="inline-block text-[10px] text-primary hover:underline"
                >
                  Run detayı →
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
