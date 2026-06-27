import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, GitBranch, LogIn, Shield } from "lucide-react";
import { BRAND } from "@/lib/branding";
import { LANDING_TAGLINE, MARKETING_LINKS } from "@/lib/marketing-links";
import { Button } from "@/components/ui/button";
import { ArchitectureDiagram } from "../ArchitectureDiagram";

const PILLARS = [
  { icon: Shield, label: "Approval-first execution" },
  { icon: GitBranch, label: "MCP plugin ecosystem" },
  { icon: LogIn, label: "Self-hosted control plane" },
] as const;

export function HeroSection() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-8 pt-12 sm:px-6 sm:pb-16 sm:pt-20">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <p className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Controlled agent runtime · MCP-native
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
            <span className="bg-gradient-to-br from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
              {BRAND.hubName}
            </span>
          </h1>
          <p className="mt-4 text-lg font-medium text-foreground/90 sm:text-xl">
            Personal AI Agent OS for tools, workflows, and daily automation.
          </p>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            {LANDING_TAGLINE}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" className="shadow-lg shadow-primary/20" asChild>
              <Link to={MARKETING_LINKS.demo}>
                Open hub
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/10 bg-card/40" asChild>
              <a href={MARKETING_LINKS.github} target="_blank" rel="noopener noreferrer">
                <GitBranch className="h-4 w-4" />
                GitHub
              </a>
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <a href="#architecture">See architecture</a>
            </Button>
          </div>

          <ul className="mt-10 flex flex-wrap gap-4 border-t border-border/60 pt-8">
            {PILLARS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Icon className="h-4 w-4 text-primary" />
                {label}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative"
        >
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-violet-500/10 blur-2xl" />
          <div className="relative rounded-2xl border border-white/10 bg-card/40 p-4 shadow-2xl backdrop-blur-md sm:p-6">
            <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Runtime stack
            </p>
            <ArchitectureDiagram compact />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
