import type { PipelineStep } from "@/lib/intent-training-api";
import { cn } from "@/lib/utils";
import { Database, GitMerge, Rocket, Tags } from "lucide-react";

const STEPS = [
  { id: "collect", label: "Topla", icon: Database },
  { id: "label", label: "Etiketle", icon: Tags },
  { id: "train", label: "Eğit", icon: GitMerge },
  { id: "promote", label: "Yayınla", icon: Rocket },
];

export function IntentPipelineStepper({
  steps,
  pipelineEnabled,
}: {
  steps: PipelineStep[];
  pipelineEnabled: boolean;
}) {
  const byId = Object.fromEntries(steps.map((s) => [s.id, s]));

  return (
    <div className="space-y-3">
      {!pipelineEnabled && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          Pipeline kapalı — üstteki anahtardan açabilirsiniz.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        {STEPS.map((step, i) => {
          const data = byId[step.id];
          const status = data?.status || "idle";
          const Icon = step.icon;
          return (
            <div key={step.id} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                  status === "active" && "border-primary bg-primary/10 text-primary",
                  status === "done" && "border-success/40 bg-success/10 text-success",
                  status === "disabled" && "border-border/40 opacity-50",
                  status === "idle" && "border-border/60 bg-card/60"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="font-medium">{step.label}</span>
                {data?.count != null && (
                  <span className="text-xs text-muted-foreground">({data.count})</span>
                )}
                {data?.version != null && (
                  <span className="text-xs text-muted-foreground">v{data.version}</span>
                )}
              </div>
              {i < STEPS.length - 1 && <span className="hidden text-muted-foreground sm:inline">→</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
