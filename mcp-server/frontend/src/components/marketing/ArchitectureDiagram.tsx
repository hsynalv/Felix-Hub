import { cn } from "@/lib/utils";

const LAYERS = [
  "Chat / Telegram / UI",
  "Agent Runtime + Prompt Intelligence",
  "Policy / Approval / Audit",
  "MCP Tool Registry",
  "Plugins: n8n, GitHub, Notion, RAG, Email, Desktop, LLM Router",
  "Memory / Project Context / Persistence",
];

export function ArchitectureDiagram({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-stretch gap-2", className)}>
      {LAYERS.map((label, i) => (
        <div key={label} className="flex flex-col items-center gap-2">
          <div className="w-full rounded-lg border border-border bg-card/60 px-4 py-3 text-center font-mono text-xs text-foreground sm:text-sm">
            {label}
          </div>
          {i < LAYERS.length - 1 && (
            <div className="text-muted-foreground" aria-hidden>
              ↓
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
