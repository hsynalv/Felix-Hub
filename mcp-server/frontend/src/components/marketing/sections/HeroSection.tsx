import { Link } from "react-router-dom";
import { Bot, GitBranch, LogIn, Layers } from "lucide-react";
import { BRAND } from "@/lib/branding";
import { MARKETING_LINKS } from "@/lib/marketing-links";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
          <Bot className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{BRAND.hubName}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Personal AI Agent OS for tools, workflows and daily automation.
        </p>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground">
          {BRAND.hubName} unifies MCP-based tool registry, agent runtime, memory, approval flows,
          Telegram control, desktop sidecar, and prompt intelligence layers in a single personal
          agent platform.
        </p>
        <p className="mt-3 text-sm italic text-muted-foreground/80">
          Kişisel agent işletim sistemi denemesi.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <a href={MARKETING_LINKS.github} target="_blank" rel="noopener noreferrer">
              <GitBranch className="h-4 w-4" />
              View on GitHub
            </a>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link to={MARKETING_LINKS.demo}>
              <LogIn className="h-4 w-4" />
              Demo / Login
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#architecture">
              <Layers className="h-4 w-4" />
              See Architecture
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
