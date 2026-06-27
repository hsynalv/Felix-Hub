const USE_CASES = [
  "Get a daily email and news digest from Telegram.",
  "Have the agent draft an n8n workflow for you.",
  "Review a GitHub repo and plan issue/PR flow.",
  "Collect project context and break coding tasks into steps.",
  "Route risky operations through approval.",
  "Run controlled local actions via the desktop sidecar.",
] as const;

export function UseCasesSection() {
  return (
    <section id="use-cases" className="scroll-mt-16 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Use cases</h2>
        <p className="mt-2 text-muted-foreground">Why it matters for builders and operators.</p>
        <ul className="mt-10 space-y-4">
          {USE_CASES.map((item) => (
            <li
              key={item}
              className="flex gap-3 rounded-lg border border-border/60 bg-card/40 px-4 py-3 text-sm leading-relaxed"
            >
              <span className="text-primary">→</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
