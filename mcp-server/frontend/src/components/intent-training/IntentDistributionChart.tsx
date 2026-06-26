import { cn } from "@/lib/utils";
import { intentBadgeClass } from "./intent-colors";

export function IntentDistributionChart({
  corpusByIntent,
  predictionsLast7d,
  intents,
}: {
  corpusByIntent: Record<string, number>;
  predictionsLast7d: Record<string, number>;
  intents: string[];
}) {
  const max = Math.max(
    1,
    ...intents.map((i) => Math.max(corpusByIntent[i] || 0, predictionsLast7d[i] || 0))
  );

  return (
    <div className="space-y-3">
      {intents.map((intent) => {
        const corpus = corpusByIntent[intent] || 0;
        const pred = predictionsLast7d[intent] || 0;
        const low = corpus < 3 && intent !== "general";
        return (
          <div key={intent} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${intentBadgeClass(intent)}`}>
                {intent}
              </span>
              <span className="text-muted-foreground">
                corpus {corpus} · 7g {pred}
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-muted/60">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  low ? "bg-amber-500/60" : "bg-primary/70"
                )}
                style={{ width: `${(corpus / max) * 100}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-foreground/10"
                style={{ width: `${(pred / max) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
