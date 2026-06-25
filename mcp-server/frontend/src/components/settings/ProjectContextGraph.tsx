import { Badge } from "@/components/ui/badge";

export interface ContextGraphNode {
  id: string;
  type: string;
  label: string;
}

export interface ContextGraphEdge {
  from: string;
  to: string;
  type: string;
}

export function ProjectContextGraph({
  nodes,
  edges,
  lastChangeSummary,
}: {
  nodes: ContextGraphNode[];
  edges: ContextGraphEdge[];
  lastChangeSummary?: string;
}) {
  if (!nodes.length) {
    return <p className="text-sm text-muted-foreground">Graph verisi yok.</p>;
  }

  return (
    <div className="space-y-4">
      {lastChangeSummary && (
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap">
          {lastChangeSummary}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {nodes.map((n) => (
          <Badge key={n.id} variant="default" className="font-normal">
            {n.type}: {n.label}
          </Badge>
        ))}
      </div>
      {edges.length > 0 && (
        <div className="space-y-1 text-xs text-muted-foreground">
          {edges.slice(0, 12).map((e, i) => (
            <p key={`${e.from}-${e.to}-${i}`}>
              {e.from} → {e.to} <span className="opacity-70">({e.type})</span>
            </p>
          ))}
          {edges.length > 12 && <p>… +{edges.length - 12} bağlantı</p>}
        </div>
      )}
    </div>
  );
}
