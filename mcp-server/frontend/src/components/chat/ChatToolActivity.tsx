import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Clock, Loader2, ShieldAlert, Wrench, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  mergeToolMessages,
  shortToolName,
  type ChatMessageRow,
  type MergedToolCall,
} from "./chat-message-groups";

function StatusIcon({ status }: { status: MergedToolCall["status"] }) {
  if (status === "running") return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
  if (status === "done") return <Check className="h-3 w-3 text-success" />;
  if (status === "denied") return <X className="h-3 w-3 text-destructive" />;
  if (status === "pending") return <ShieldAlert className="h-3 w-3 text-amber-400" />;
  return <Clock className="h-3 w-3 text-muted-foreground" />;
}

function statusLabel(status: MergedToolCall["status"]) {
  if (status === "running") return "çalışıyor";
  if (status === "done") return "tamam";
  if (status === "denied") return "reddedildi";
  if (status === "pending") return "onay";
  return "bilinmiyor";
}

type ChatToolActivityProps = {
  tools: ChatMessageRow[];
};

export function ChatToolActivity({ tools }: ChatToolActivityProps) {
  const merged = useMemo(() => mergeToolMessages(tools), [tools]);
  const [expanded, setExpanded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  if (merged.length === 0) return null;

  const anyRunning = merged.some((t) => t.status === "running");
  const active = merged.find((t) => t.id === activeId);

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

      <div className="flex flex-wrap gap-1.5 px-3 pb-2.5">
        {merged.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={() => {
              setActiveId((id) => (id === tool.id ? null : tool.id));
              if (!expanded) setExpanded(true);
            }}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[10px] transition-colors",
              activeId === tool.id
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border/50 bg-background/50 text-muted-foreground hover:border-border hover:bg-background/80"
            )}
          >
            <StatusIcon status={tool.status} />
            <span className="truncate">{shortToolName(tool.name)}</span>
            <span className="text-[9px] uppercase tracking-wide opacity-60">{statusLabel(tool.status)}</span>
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {expanded && active?.detail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border/40"
          >
            <div className="space-y-1 px-3 py-2">
              <p className="font-mono text-[10px] font-medium text-foreground/80">{active.name}</p>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background/60 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                {active.detail}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
