import { useMemo } from "react";
import type { BrainMemory, BrainProject } from "@/lib/brain-api";
import { cn } from "@/lib/utils";

interface GraphNode {
  id: string;
  label: string;
  kind: "memory" | "project" | "tag";
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
}

interface BrainGraphProps {
  memories: BrainMemory[];
  projects: BrainProject[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

export function BrainGraph({ memories, projects, selectedId, onSelect, className }: BrainGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const tagSet = new Set<string>();

    memories.slice(0, 40).forEach((m, i) => {
      const angle = (i / Math.max(memories.length, 1)) * Math.PI * 2;
      const r = 120 + (i % 3) * 24;
      nodes.push({
        id: m.id,
        label: m.content.slice(0, 24),
        kind: "memory",
        x: 200 + Math.cos(angle) * r,
        y: 160 + Math.sin(angle) * r,
      });
      m.tags?.forEach((t) => tagSet.add(t));
      if (m.projectId) edges.push({ from: m.id, to: `proj:${m.projectId}` });
      m.tags?.forEach((t) => edges.push({ from: m.id, to: `tag:${t}` }));
    });

    projects.slice(0, 8).forEach((p, i) => {
      const slug = p.slug || p.name;
      nodes.push({
        id: `proj:${slug}`,
        label: slug,
        kind: "project",
        x: 60 + i * 44,
        y: 40,
      });
    });

    [...tagSet].slice(0, 10).forEach((t, i) => {
      nodes.push({
        id: `tag:${t}`,
        label: `#${t}`,
        kind: "tag",
        x: 320 + (i % 5) * 36,
        y: 280 + Math.floor(i / 5) * 28,
      });
    });

    return { nodes, edges };
  }, [memories, projects]);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">Graph için bellek yok</p>;
  }

  return (
    <div className={cn("overflow-auto rounded-lg border border-border bg-muted/30", className)}>
      <svg viewBox="0 0 400 320" className="h-64 w-full min-w-[400px]">
        {edges.map((e, i) => {
          const a = nodeMap.get(e.from);
          const b = nodeMap.get(e.to);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="currentColor"
              strokeOpacity={0.15}
              strokeWidth={1}
            />
          );
        })}
        {nodes.map((n) => {
          const isMem = n.kind === "memory";
          const selected = isMem && n.id === selectedId;
          const fill =
            n.kind === "project"
              ? "var(--color-primary)"
              : n.kind === "tag"
                ? "var(--color-accent)"
                : selected
                  ? "var(--color-primary)"
                  : "var(--color-muted)";
          return (
            <g
              key={n.id}
              className={isMem ? "cursor-pointer" : ""}
              onClick={() => isMem && onSelect(n.id)}
            >
              <circle
                cx={n.x}
                cy={n.y}
                r={isMem ? 10 : 7}
                fill={fill}
                fillOpacity={0.85}
              />
              <title>{n.label}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
