import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { IntentSample } from "@/lib/intent-training-api";
import { patchIntentSample } from "@/lib/intent-training-api";
import { intentBadgeClass } from "./intent-colors";

export function IntentReviewQueue({
  samples,
  onUpdated,
}: {
  samples: IntentSample[];
  onUpdated: () => void;
}) {
  if (!samples.length) {
    return <p className="text-sm text-muted-foreground">Bekleyen inceleme yok.</p>;
  }

  return (
    <div className="space-y-3">
      {samples.map((s) => (
        <ReviewRow key={s.id} sample={s} onUpdated={onUpdated} />
      ))}
    </div>
  );
}

function ReviewRow({ sample, onUpdated }: { sample: IntentSample; onUpdated: () => void }) {
  const reject = useMutation({
    mutationFn: () => patchIntentSample(sample.id, { reject: true }),
    onSuccess: onUpdated,
  });

  return (
    <div className="rounded-lg border border-border/60 p-3 text-sm">
      <p className="font-medium">{sample.userMessage}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Tahmin:{" "}
        <span className={`rounded px-1 font-mono ${intentBadgeClass(sample.predictedIntent)}`}>
          {sample.predictedIntent}
        </span>
        {sample.llmSuggestedIntent && (
          <> · LLM öneri: {sample.llmSuggestedIntent}</>
        )}
      </p>
      <Button className="mt-2" size="sm" variant="ghost" disabled={reject.isPending} onClick={() => reject.mutate()}>
        Reddet
      </Button>
    </div>
  );
}
