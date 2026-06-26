import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/utils";
import { rollbackIntentModel } from "@/lib/intent-training-api";

export function ModelVersionTimeline({
  models,
  activeVersion,
  onRollback,
}: {
  models: Array<{
    version: number;
    corpusCount: number;
    evalAccuracy: number | null;
    promotedAt?: string;
  }>;
  activeVersion: number | null;
  onRollback: () => void;
}) {
  if (!models.length) {
    return <p className="text-sm text-muted-foreground">Henüz promote edilmiş model yok.</p>;
  }

  return (
    <div className="space-y-3">
      {models.map((m) => (
        <div
          key={m.version}
          className={`rounded-lg border p-3 text-sm ${
            m.version === activeVersion ? "border-primary/50 bg-primary/5" : "border-border/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">v{m.version}</span>
            {m.version !== activeVersion && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await rollbackIntentModel(m.version);
                  onRollback();
                }}
              >
                Geri al
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            corpus {m.corpusCount}
            {m.evalAccuracy != null && ` · doğruluk ${(m.evalAccuracy * 100).toFixed(1)}%`}
          </p>
          {m.promotedAt && (
            <p className="text-[10px] text-muted-foreground">{formatTime(m.promotedAt)}</p>
          )}
        </div>
      ))}
    </div>
  );
}
