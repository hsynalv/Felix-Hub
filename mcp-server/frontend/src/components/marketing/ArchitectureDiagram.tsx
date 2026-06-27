import {
  Bot,
  Database,
  Layers,
  MessageSquare,
  Plug,
  Shield,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Layer = {
  label: string;
  sub?: string;
  icon: LucideIcon;
  accent: string;
};

const LAYERS: Layer[] = [
  {
    label: "Channels",
    sub: "Web UI · Chat · Messaging",
    icon: MessageSquare,
    accent: "from-violet-500/20 to-indigo-500/10",
  },
  {
    label: "Agent runtime",
    sub: "Planning · Prompt modes · Tool choice",
    icon: Bot,
    accent: "from-indigo-500/20 to-blue-500/10",
  },
  {
    label: "Policy layer",
    sub: "Approval · Audit · Guardrails",
    icon: Shield,
    accent: "from-blue-500/20 to-cyan-500/10",
  },
  {
    label: "Tool registry",
    sub: "MCP-compatible schemas",
    icon: Layers,
    accent: "from-cyan-500/20 to-emerald-500/10",
  },
  {
    label: "Plugins",
    sub: "Integrations & connectors",
    icon: Plug,
    accent: "from-emerald-500/20 to-teal-500/10",
  },
  {
    label: "Memory & context",
    sub: "Projects · Persistence",
    icon: Database,
    accent: "from-teal-500/20 to-violet-500/10",
  },
];

export function ArchitectureDiagram({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-primary/5 via-transparent to-transparent"
        aria-hidden
      />
      <div className={cn("relative flex flex-col gap-2", compact ? "gap-1.5" : "gap-2.5")}>
        {LAYERS.map((layer, i) => {
          const Icon = layer.icon;
          return (
            <div key={layer.label} className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-card/70 px-4 shadow-sm backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5",
                  compact ? "py-2.5" : "py-3.5",
                  `bg-gradient-to-r ${layer.accent}`
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/60 ring-1 ring-white/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 text-left">
                  <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
                    {layer.label}
                  </p>
                  {layer.sub && (
                    <p className="truncate text-xs text-muted-foreground">{layer.sub}</p>
                  )}
                </div>
                {i === 1 && (
                  <Sparkles className="ml-auto hidden h-4 w-4 shrink-0 text-primary/60 sm:block" />
                )}
              </div>
              {i < LAYERS.length - 1 && (
                <div
                  className="h-3 w-px bg-gradient-to-b from-border to-transparent"
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
