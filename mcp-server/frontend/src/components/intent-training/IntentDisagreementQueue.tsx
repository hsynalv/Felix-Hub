import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IntentSample } from "@/lib/intent-training-api";
import { resolveDisagreement } from "@/lib/intent-training-api";
import { intentBadgeClass } from "./intent-colors";

export function IntentDisagreementQueue({
  samples,
  intents,
  onResolved,
}: {
  samples: IntentSample[];
  intents: string[];
  onResolved: () => void;
}) {
  if (!samples.length) {
    return <p className="text-sm text-muted-foreground">Çelişki bekleyen örnek yok.</p>;
  }

  return (
    <div className="space-y-4">
      {samples.map((s) => (
        <DisagreementCard key={s.id} sample={s} intents={intents} onResolved={onResolved} />
      ))}
    </div>
  );
}

function DisagreementCard({
  sample,
  intents,
  onResolved,
}: {
  sample: IntentSample;
  intents: string[];
  onResolved: () => void;
}) {
  const [customIntent, setCustomIntent] = useState("general");
  const resolve = useMutation({
    mutationFn: (body: Parameters<typeof resolveDisagreement>[1]) =>
      resolveDisagreement(sample.id, body),
    onSuccess: onResolved,
  });

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <p className="text-sm font-medium">{sample.userMessage}</p>
      <div className="grid gap-2 sm:grid-cols-2 text-sm">
        <div>
          <span className="text-muted-foreground">Algoritma: </span>
          <span className={`rounded px-1.5 py-0.5 font-mono text-xs ${intentBadgeClass(sample.predictedIntent)}`}>
            {sample.predictedIntent}
          </span>
          <span className="ml-1 text-xs text-muted-foreground">
            {(sample.predictedConfidence * 100).toFixed(0)}%
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Eğitim LLM: </span>
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-xs ${intentBadgeClass(sample.llmSuggestedIntent || "general")}`}
          >
            {sample.llmSuggestedIntent || "—"}
          </span>
        </div>
      </div>
      {sample.labelReason && (
        <p className="text-xs text-muted-foreground">{sample.labelReason}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={resolve.isPending} onClick={() => resolve.mutate({ choice: "runtime" })}>
          Algoritma doğru
        </Button>
        <Button size="sm" variant="outline" disabled={resolve.isPending} onClick={() => resolve.mutate({ choice: "llm" })}>
          LLM doğru
        </Button>
        <Select value={customIntent} onValueChange={setCustomIntent}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {intents.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={resolve.isPending}
          onClick={() => resolve.mutate({ choice: "custom", customIntent })}
        >
          Başka intent
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={resolve.isPending}
          onClick={() => resolve.mutate({ reject: true })}
        >
          Reddet
        </Button>
      </div>
    </div>
  );
}
