import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { classifyPlayground, addCorpusUtterance } from "@/lib/intent-training-api";
import { intentBadgeClass } from "./intent-colors";

const CHIPS = [
  "gigi projesinde tl karşılığı ne",
  "n8n workflow oluştur",
  "git status ne",
];

export function IntentPlayground({ onCorpusAdded }: { onCorpusAdded?: () => void }) {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof classifyPlayground>> | null>(null);

  const classify = useMutation({
    mutationFn: () => classifyPlayground(message),
    onSuccess: (data) => setResult(data),
  });

  const addCorpus = useMutation({
    mutationFn: () => {
      if (!result?.merged.intent) throw new Error("classify first");
      return addCorpusUtterance(result.merged.intent, message);
    },
    onSuccess: () => onCorpusAdded?.(),
  });

  return (
    <div className="space-y-3">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Test mesajı yazın…"
        rows={2}
      />
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            className="rounded-full border border-border/60 px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            onClick={() => setMessage(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={!message.trim() || classify.isPending} onClick={() => classify.mutate()}>
          Sınıflandır
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!result || addCorpus.isPending}
          onClick={() => addCorpus.mutate()}
        >
          Corpus&apos;a ekle
        </Button>
      </div>
      {result && (
        <div className="grid gap-2 sm:grid-cols-3">
          <ResultCard title="Regex" intent={result.regex.intent} confidence={result.regex.confidence} />
          <ResultCard
            title="NLP"
            intent={result.nlp?.intent || "—"}
            confidence={result.nlp?.confidence ?? 0}
          />
          <ResultCard
            title="Kazanan"
            intent={result.merged.intent}
            confidence={result.merged.confidence}
            highlight
            source={result.merged.source}
          />
        </div>
      )}
    </div>
  );
}

function ResultCard({
  title,
  intent,
  confidence,
  highlight,
  source,
}: {
  title: string;
  intent: string;
  confidence: number;
  highlight?: boolean;
  source?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${highlight ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card/50"}`}
    >
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className={`mt-1 inline-block rounded px-2 py-0.5 font-mono text-sm ${intentBadgeClass(intent)}`}>
        {intent}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{(confidence * 100).toFixed(0)}%</p>
      {source && <p className="text-[10px] text-muted-foreground">source: {source}</p>}
    </div>
  );
}
