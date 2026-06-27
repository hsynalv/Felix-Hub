import { motion } from "framer-motion";
import {
  Bot,
  FlaskConical,
  GitBranch,
  MessageSquare,
  Package,
  Shield,
  Smartphone,
  Sparkles,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeader } from "../SectionHeader";

const HIGHLIGHTS: Array<{ icon: LucideIcon; text: string; span?: string }> = [
  { icon: Package, text: "MCP plugin system", span: "col-span-1" },
  { icon: Workflow, text: "Agent & workflow orchestration", span: "col-span-1" },
  { icon: Shield, text: "Approval center & policy engine", span: "col-span-1" },
  {
    icon: Bot,
    text: "Prompt modes: chat, agent, spec, review, ops, desktop",
    span: "sm:col-span-2",
  },
  { icon: Sparkles, text: "Prompt registry & behavior packs", span: "col-span-1" },
  { icon: FlaskConical, text: "Eval & regression tooling", span: "col-span-1" },
  { icon: MessageSquare, text: "Messaging channel assistant", span: "col-span-1" },
  { icon: Smartphone, text: "Desktop / sidecar agent path", span: "col-span-1" },
  { icon: GitBranch, text: "Workflow builder integration", span: "sm:col-span-2" },
];

export function HighlightsSection() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="Platform"
          title="Built for real agent workloads"
          description="Core surfaces shipping today — extensible through plugins, not hard-coded one-offs."
        />
        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.text}
                initial={{ opacity: 0, scale: 0.98 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-3 rounded-xl border border-white/10 bg-background/50 px-4 py-3.5 ${item.span ?? ""}`}
              >
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm">{item.text}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
