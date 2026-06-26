export function IntentCorpusExplorer({
  entries,
}: {
  entries: Array<{ intent: string; utterance: string; locale: string; source: string }>;
}) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">Corpus boş.</p>;

  return (
    <div className="max-h-80 space-y-2 overflow-y-auto">
      {entries.map((e, i) => (
        <div key={`${e.intent}-${i}`} className="rounded border border-border/50 px-3 py-2 text-sm">
          <span className="font-mono text-xs text-muted-foreground">{e.intent}</span>
          <p>{e.utterance}</p>
          <p className="text-[10px] text-muted-foreground">
            {e.source} · {e.locale}
          </p>
        </div>
      ))}
    </div>
  );
}
