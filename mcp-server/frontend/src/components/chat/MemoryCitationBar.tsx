import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Pencil, ThumbsDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitMemoryFeedback } from "@/lib/brain-api";
import { useToast } from "@/providers/ToastProvider";

const MEMORY_ID_RE = /\[memory:([^\s\]]+)/g;

export function extractMemoryIds(text: string): string[] {
  const ids = new Set<string>();
  let match;
  const re = new RegExp(MEMORY_ID_RE.source, "g");
  while ((match = re.exec(text)) !== null) {
    ids.add(match[1]);
  }
  return [...ids];
}

type MemoryCitationBarProps = {
  content: string;
};

export function MemoryCitationBar({ content }: MemoryCitationBarProps) {
  const ids = extractMemoryIds(content);
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  if (ids.length === 0) return null;

  const act = async (id: string, action: "confirm" | "reject" | "forget") => {
    setBusy(id);
    try {
      await submitMemoryFeedback(id, { action });
      toast.show(action === "forget" ? "Bellek unutuldu" : "Geri bildirim kaydedildi");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Geri bildirim başarısız", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-2 py-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Kaynak</span>
      {ids.map((id) => (
        <div key={id} className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-2 font-mono text-[10px]" asChild>
            <Link to={`/brain?id=${encodeURIComponent(id)}`}>{id.slice(0, 12)}…</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={busy === id}
            title="Doğru"
            onClick={() => act(id, "confirm")}
          >
            <Check className="h-3 w-3 text-success" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={busy === id}
            title="Yanlış"
            onClick={() => act(id, "reject")}
          >
            <ThumbsDown className="h-3 w-3 text-amber-500" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={busy === id}
            title="Unut"
            onClick={() => act(id, "forget")}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Düzenle" asChild>
            <Link to={`/brain?id=${encodeURIComponent(id)}&edit=1`}>
              <Pencil className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      ))}
    </div>
  );
}
