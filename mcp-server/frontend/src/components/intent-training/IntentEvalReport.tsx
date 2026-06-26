export function IntentEvalReport({
  evalReport,
}: {
  evalReport?: Record<string, unknown> | null;
}) {
  if (!evalReport) {
    return <p className="text-sm text-muted-foreground">Son eğitim raporu yok.</p>;
  }

  const golden = evalReport.goldenNlp as { accuracy?: number; failures?: unknown[] } | undefined;
  const holdout = evalReport.holdout as { accuracy?: number } | undefined;

  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Golden NLP" value={golden?.accuracy} />
        <Stat label="Holdout" value={holdout?.accuracy} />
      </div>
      {Array.isArray(golden?.failures) && golden.failures.length > 0 && (
        <div>
          <p className="font-medium mb-2">Golden hataları</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {(golden.failures as Array<{ utterance: string; expected: string; got: string }>).map(
              (f, i) => (
                <li key={i}>
                  &quot;{f.utterance}&quot; — beklenen {f.expected}, gelen {f.got}
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">
        {value != null ? `${(value * 100).toFixed(1)}%` : "—"}
      </p>
    </div>
  );
}
