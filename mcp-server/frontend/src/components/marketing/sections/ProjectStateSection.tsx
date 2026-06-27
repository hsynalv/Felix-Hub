import { Link } from "react-router-dom";
import { ArrowRight, Circle } from "lucide-react";
import { MARKETING_LINKS } from "@/lib/marketing-links";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "../SectionHeader";

const STATUS_ITEMS = [
  { label: "Core runtime & tool registry", status: "live" as const },
  { label: "Approval, audit & policy", status: "live" as const },
  { label: "Memory & project context", status: "live" as const },
  { label: "Messaging & desktop channels", status: "beta" as const },
  { label: "Prompt intelligence layer", status: "beta" as const },
];

const STATUS_COLOR = {
  live: "text-emerald-400",
  beta: "text-amber-400",
} as const;

export function ProjectStateSection() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-end">
          <SectionHeader
            eyebrow="Status"
            title="Production-minded MVP"
            description="Active development with a stable core. New surfaces ship behind the same policy and observability path as existing tools."
          />
          <ul className="space-y-3 rounded-2xl border border-white/10 bg-card/50 p-6">
            {STATUS_ITEMS.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-4 text-sm">
                <span>{item.label}</span>
                <span
                  className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${STATUS_COLOR[item.status]}`}
                >
                  <Circle className="h-2 w-2 fill-current" />
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-16 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-violet-500/5 to-transparent p-8 text-center sm:p-10">
          <h3 className="text-xl font-semibold sm:text-2xl">Ready to explore the hub?</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Sign in to your instance or browse the source to run Felix on your own stack.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to={MARKETING_LINKS.login}>
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href={MARKETING_LINKS.github} target="_blank" rel="noopener noreferrer">
                View on GitHub
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
