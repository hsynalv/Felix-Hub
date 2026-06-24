import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export type SlashPluginOption = {
  name: string;
  description?: string;
  toolCount?: number;
};

type ChatSlashMenuProps = {
  plugins: SlashPluginOption[];
  highlightIndex: number;
  onSelect: (pluginName: string) => void;
  className?: string;
};

export function ChatSlashMenu({ plugins, highlightIndex, onSelect, className }: ChatSlashMenuProps) {
  if (plugins.length === 0) {
    return (
      <div
        className={cn(
          "absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-xl border border-border/80",
          "bg-card/98 shadow-2xl shadow-black/40 backdrop-blur-xl",
          "dark:border-border/60 dark:bg-[oklch(0.11_0.02_260/0.98)] dark:shadow-black/60",
          "p-3 text-xs text-muted-foreground",
          className
        )}
      >
        Eşleşen eklenti yok
      </div>
    );
  }

  return (
    <div
      className={cn(
        "absolute bottom-full left-0 right-0 z-20 mb-2 max-h-56 overflow-y-auto rounded-xl border border-border/80",
        "bg-card/98 shadow-2xl shadow-black/40 backdrop-blur-xl",
        "dark:border-border/60 dark:bg-[oklch(0.11_0.02_260/0.98)] dark:shadow-black/60",
        className
      )}
      role="listbox"
    >
      <div className="border-b border-border/60 bg-muted/30 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Eklenti seç
      </div>
      <ul className="p-1">
        {plugins.map((p, i) => (
          <li key={p.name}>
            <button
              type="button"
              role="option"
              aria-selected={i === highlightIndex}
              className={cn(
                "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                i === highlightIndex
                  ? "bg-primary/15 text-foreground"
                  : "hover:bg-muted/60 dark:hover:bg-muted/40"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(p.name);
              }}
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <LayoutGrid className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-sm font-medium">/{p.name}</span>
                <span className="line-clamp-1 text-[11px] text-muted-foreground">
                  {p.description || "Eklenti"}
                  {p.toolCount != null ? ` · ${p.toolCount} araç` : ""}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
