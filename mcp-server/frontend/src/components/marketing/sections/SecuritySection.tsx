import { ShieldCheck } from "lucide-react";

const SECURITY_POINTS = [
  "Approval mechanism for risky tool calls",
  "Explanation required on write/destructive tools",
  "Audit log for operations",
  "Policy guards on tool execution",
  "Sidecar allowlist target for local control",
  "Safe-control approach for Telegram and desktop channels",
] as const;

export function SecuritySection() {
  return (
    <section id="security" className="scroll-mt-16 border-t border-border/60 bg-card/20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-primary" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Powerful, but approval-first.
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              An agent that can touch your tools and machine needs explicit guardrails — not blind
              trust.
            </p>
          </div>
        </div>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {SECURITY_POINTS.map((point) => (
            <li
              key={point}
              className="rounded-lg border border-border/60 bg-background/50 px-4 py-3 text-sm"
            >
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
