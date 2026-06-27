import { BookOpen, GitBranch, Layers } from "lucide-react";
import { MARKETING_LINKS } from "@/lib/marketing-links";
import { Button } from "@/components/ui/button";

const STACK = [
  "Node.js backend",
  "MCP-compatible tool registry",
  "Plugin-based architecture",
  "Prompt registry",
  "Eval scripts",
  "Extensible connector structure",
] as const;

export function DeveloperSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Built for developers experimenting with agentic workflows.
        </h2>
        <ul className="mt-8 grid gap-2 sm:grid-cols-2">
          {STACK.map((item) => (
            <li key={item} className="text-sm text-muted-foreground">
              · {item}
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button variant="default" asChild>
            <a href={MARKETING_LINKS.github} target="_blank" rel="noopener noreferrer">
              <GitBranch className="h-4 w-4" />
              View GitHub
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={MARKETING_LINKS.docs} target="_blank" rel="noopener noreferrer">
              <BookOpen className="h-4 w-4" />
              Read Docs
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={MARKETING_LINKS.architecture} target="_blank" rel="noopener noreferrer">
              <Layers className="h-4 w-4" />
              Open Architecture
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
