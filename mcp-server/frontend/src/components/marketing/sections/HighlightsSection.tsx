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

const HIGHLIGHTS = [
  { icon: Package, text: "MCP-based plugin system" },
  { icon: Workflow, text: "Agent workflow and task orchestration" },
  { icon: Shield, text: "Human-in-the-loop approval" },
  { icon: Bot, text: "Prompt modes: chat, agent, spec, review, ops, desktop" },
  { icon: Sparkles, text: "Prompt marketplace and importer" },
  { icon: FlaskConical, text: "Eval and tool-choice regression infrastructure" },
  { icon: MessageSquare, text: "Telegram personal assistant" },
  { icon: Smartphone, text: "Local sidecar / desktop control foundation" },
  { icon: GitBranch, text: "n8n workflow builder integration" },
  { icon: Bot, text: "Brain/memory + project context" },
] as const;

export function HighlightsSection() {
  return (
    <section className="border-t border-border/60 bg-card/20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Key capabilities</h2>
        <p className="mt-2 text-muted-foreground">Product surface — what ships in the hub today.</p>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/50 px-4 py-3"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
