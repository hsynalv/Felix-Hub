const STATE_ITEMS = [
  "MVP core completed",
  "Active hardening",
  "Experimental desktop and personal assistant features",
  "Open to feedback and collaboration",
] as const;

export function ProjectStateSection() {
  return (
    <section className="border-t border-border/60 bg-card/20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Current state</h2>
        <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
          Felix Hub is an active MVP with working layers for agent runtime, tool registry, memory,
          approval, Telegram, desktop sidecar, prompt intelligence, and plugin integrations.
        </p>
        <ul className="mt-8 space-y-2">
          {STATE_ITEMS.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
