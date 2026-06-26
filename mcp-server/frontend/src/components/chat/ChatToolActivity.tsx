import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Loader2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { mergeToolMessages, type ChatMessageRow } from "./chat-message-groups";
import { ToolTraceRow } from "./ToolTraceRow";

type ChatToolActivityProps = {
  tools: ChatMessageRow[];
  runId?: string | null;
};

export function ChatToolActivity({ tools, runId }: ChatToolActivityProps) {
  const merged = useMemo(() => mergeToolMessages(tools), [tools]);
  const [expanded, setExpanded] = useState(false);

  if (merged.length === 0) return null;

  const anyRunning = merged.some((t) => t.status === "running");

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-muted/15">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/25"
      >
        <Wrench className="h-3.5 w-3.5 shrink-0 text-primary/80" />
        <span className="min-w-0 flex-1 truncate">
          {anyRunning ? "Araçlar çalışıyor…" : `${merged.length} araç kullanıldı`}
        </span>
        {anyRunning && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-180")}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border/40"
          >
            <div className="space-y-1.5 p-2">
              {merged.map((tool) => (
                <ToolTraceRow
                  key={tool.id}
                  tool={tool}
                  runId={runId}
                  arguments={tool.arguments}
                  summary={tool.summary}
                  defaultOpen={merged.length === 1}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
