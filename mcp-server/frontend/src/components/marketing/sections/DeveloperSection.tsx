import { BookOpen, Code2, GitBranch, Layers, Puzzle, TestTube2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MARKETING_LINKS } from "@/lib/marketing-links";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "../SectionHeader";

const STACK: Array<{ icon: LucideIcon; label: string }> = [
  { icon: Code2, label: "Node.js hub server" },
  { icon: Puzzle, label: "MCP-compatible tool registry" },
  { icon: Layers, label: "Plugin-based connectors" },
  { icon: BookOpen, label: "Prompt registry & modes" },
  { icon: TestTube2, label: "Eval & smoke regression scripts" },
  { icon: GitBranch, label: "Open-source, self-hosted" },
];

export function DeveloperSection() {
  return (
    <section className="border-y border-border/40 bg-card/20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <SectionHeader
            eyebrow="Developers"
            title="Extend the platform, not fork it"
            description="Felix Hub is built for engineers who want to experiment with agentic workflows on their own infrastructure."
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {STACK.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-background/50 px-4 py-3 text-sm"
              >
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild>
            <a href={MARKETING_LINKS.github} target="_blank" rel="noopener noreferrer">
              <GitBranch className="h-4 w-4" />
              View GitHub
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={MARKETING_LINKS.docs} target="_blank" rel="noopener noreferrer">
              <BookOpen className="h-4 w-4" />
              Documentation
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={MARKETING_LINKS.architecture} target="_blank" rel="noopener noreferrer">
              <Layers className="h-4 w-4" />
              Architecture guide
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
