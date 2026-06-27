import { motion } from "framer-motion";
import { FileText, Lock, ScrollText, ShieldCheck, Sliders, Terminal, UserCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeader } from "../SectionHeader";

const SECURITY_POINTS: Array<{ icon: LucideIcon; title: string; description: string }> = [
  {
    icon: UserCheck,
    title: "Approval queue",
    description: "High-risk tool calls pause until explicitly approved.",
  },
  {
    icon: FileText,
    title: "Required explanations",
    description: "Write and destructive tools must include a human-readable reason.",
  },
  {
    icon: ScrollText,
    title: "Audit trail",
    description: "Operations are logged with actor, tool, and outcome metadata.",
  },
  {
    icon: Sliders,
    title: "Policy engine",
    description: "Tag-based rules filter what agents can invoke per context.",
  },
  {
    icon: Terminal,
    title: "Safe shell by default",
    description:
      "Production uses read-only safe shell. Power mode is admin-only with explicit approval per command.",
  },
  {
    icon: Lock,
    title: "Workspace boundaries",
    description: "Cross-workspace access is blocked; global workspace is read-only for writes in production.",
  },
  {
    icon: ShieldCheck,
    title: "Channel hardening",
    description: "Explicit CORS origins, authenticated APIs, and redacted shell audit logs.",
  },
];

export function SecuritySection() {
  return (
    <section id="security" className="scroll-mt-16 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-card/80 via-background to-card/40 p-8 sm:p-12">
          <SectionHeader
            eyebrow="Security"
            title="Powerful, but approval-first"
            description="Felix can reach powerful tools — so the security model is designed around controlled execution, not blind trust."
          />
          <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-muted-foreground sm:text-base">
            Production mode uses safe shell defaults, explicit CORS whitelist, authenticated API access,
            policy-backed approvals, workspace boundaries, audit logging, and redaction for sensitive
            command data. Power shell is admin-only.
          </p>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground/90">
            Felix güçlü araçlara erişebilir; bu yüzden güvenlik modeli onay-öncelikli tasarlandı.
            Production modunda safe shell, açık CORS whitelist, kimlik doğrulamalı API, policy onayları,
            workspace sınırları, audit log ve komut redaction kullanılır.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SECURITY_POINTS.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-xl border border-white/10 bg-background/60 p-4"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
