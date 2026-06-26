import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bot, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJarvisOverlay } from "@/lib/personal-api";
import { Button } from "@/components/ui/button";

/** Floating "şu an ne yapıyor?" companion (V7 Faz 4). */
export function JarvisOverlay() {
  const [expanded, setExpanded] = useState(false);
  const { data } = useQuery({
    queryKey: ["jarvis-overlay"],
    queryFn: fetchJarvisOverlay,
    refetchInterval: 12_000,
    staleTime: 8_000,
  });

  if (!data) return null;

  const busy = data.status !== "idle" || data.pendingApprovals > 0;

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-4 right-4 z-40 flex max-w-sm flex-col items-end gap-2",
        "pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]"
      )}
    >
      {expanded && (
        <div className="pointer-events-auto w-72 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur sm:w-80">
          <p className="text-xs font-medium text-muted-foreground">{data.mode} modu</p>
          <p className="mt-1 text-sm">{data.message}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {data.activeRunCount > 0 && <span>{data.activeRunCount} aktif run</span>}
            {data.pendingApprovals > 0 && <span>{data.pendingApprovals} onay</span>}
            {data.emergencyStop && <span className="text-destructive">Acil durdur</span>}
            {data.hubPaused && <span>Duraklatıldı</span>}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/runs">Run'lar</Link>
            </Button>
            {data.pendingApprovals > 0 && (
              <Button size="sm" asChild>
                <Link to="/approvals">Onayla</Link>
              </Button>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-2 text-sm shadow-md backdrop-blur transition-colors",
          busy ? "border-primary bg-primary/10 text-primary" : "bg-card/95 text-foreground"
        )}
      >
        {data.emergencyStop ? (
          <ShieldAlert className="h-4 w-4 text-destructive" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
        <span className="max-w-[10rem] truncate">{busy ? data.message : "Jarvis"}</span>
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>
    </div>
  );
}
