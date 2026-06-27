import { motion } from "framer-motion";
import {
  Brain,
  CheckCircle2,
  Cpu,
  Monitor,
  Send,
  Wrench,
} from "lucide-react";
import { SectionHeader } from "../SectionHeader";

const CAPABILITIES = [
  {
    icon: Wrench,
    title: "Unified tool layer",
    description:
      "One registry for integrations — source control, knowledge bases, automation, messaging, and model routing.",
  },
  {
    icon: Brain,
    title: "Persistent context",
    description:
      "Memory and project scope carry state across sessions so agents do not start from zero every time.",
  },
  {
    icon: Cpu,
    title: "Workflow orchestration",
    description:
      "Long-running agent runs and workflow steps decompose goals into trackable, resumable work.",
  },
  {
    icon: CheckCircle2,
    title: "Human-in-the-loop",
    description:
      "Sensitive operations pause for approval instead of executing silently in the background.",
  },
  {
    icon: Send,
    title: "Remote triggers",
    description:
      "Kick off summaries, checks, and automations from messaging channels when you are away from the desk.",
  },
  {
    icon: Monitor,
    title: "Local environment bridge",
    description:
      "Optional desktop agent path for controlled interaction with files and tools on your machine.",
  },
] as const;

export function WhatItDoesSection() {
  return (
    <section id="features" className="scroll-mt-16 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="Capabilities"
          title="What Felix Hub does"
          description="Everything an agent needs to operate in production-like conditions — without handing the model unchecked access."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group rounded-2xl border border-white/10 bg-card/50 p-6 transition-colors hover:border-primary/25 hover:bg-card/80"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{item.title}</h3>
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
