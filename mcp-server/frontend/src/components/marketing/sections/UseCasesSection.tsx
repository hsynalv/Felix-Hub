import { motion } from "framer-motion";
import {
  Bell,
  GitPullRequest,
  ListTodo,
  Mail,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeader } from "../SectionHeader";

const USE_CASES: Array<{ icon: LucideIcon; title: string; description: string }> = [
  {
    icon: Mail,
    title: "Morning briefings",
    description: "Aggregate inbox and feed updates into a single digest you can request on demand.",
  },
  {
    icon: GitPullRequest,
    title: "Repo intelligence",
    description: "Inspect a codebase, summarize changes, and outline issue or PR next steps.",
  },
  {
    icon: ListTodo,
    title: "Task decomposition",
    description: "Turn a vague goal into scoped steps with project context attached.",
  },
  {
    icon: Bell,
    title: "Automation drafts",
    description: "Describe a workflow; the agent proposes nodes and wiring you can review.",
  },
  {
    icon: ShieldAlert,
    title: "Gated operations",
    description: "Destructive or high-impact tool calls wait in an approval queue.",
  },
  {
    icon: Terminal,
    title: "Local execution",
    description: "Run approved actions on your machine through a bounded sidecar channel.",
  },
];

export function UseCasesSection() {
  return (
    <section id="use-cases" className="scroll-mt-16 border-y border-border/40 bg-card/20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="Use cases"
          title="Where teams actually use it"
          description="Practical patterns — not demo prompts. Each flow respects the same policy and audit path."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-white/10 bg-background/50 p-5"
              >
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
