import { motion } from "framer-motion";
import { Link2, Play, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeader } from "../SectionHeader";

const STEPS: Array<{ step: string; title: string; description: string; icon: LucideIcon }> = [
  {
    step: "01",
    title: "Connect your tools",
    description:
      "Register integrations through an MCP-compatible plugin layer — repos, docs, workflows, messaging, and more in one registry.",
    icon: Link2,
  },
  {
    step: "02",
    title: "Agent plans and acts",
    description:
      "The runtime chooses tools, breaks work into steps, and applies prompt modes for chat, coding, spec, or ops tasks.",
    icon: Play,
  },
  {
    step: "03",
    title: "Policy gates execution",
    description:
      "Risky writes and destructive actions require explanation, approval, and leave an audit trail before they run.",
    icon: ShieldCheck,
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-16 border-y border-border/40 bg-card/30 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="How it works"
          title="From model output to real actions — safely"
          description="Felix is not a chat box with API keys pasted in. It is a control plane that sits between the model and your environment."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.08 }}
                className="relative rounded-2xl border border-white/10 bg-background/60 p-6 backdrop-blur-sm"
              >
                <span className="text-4xl font-bold text-primary/20">{item.step}</span>
                <div className="mt-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
