import { useCallback, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import type { BrainMemory, BrainProject, MemoryType } from "@/lib/brain-api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LayoutNode {
  id: string;
  label: string;
  kind: "memory" | "project" | "tag";
  memoryType?: MemoryType;
  importance: number;
  x: number;
  y: number;
}

interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  kind: "project" | "tag";
}

const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  fact: "Gerçek",
  decision: "Karar",
  preference: "Tercih",
  event: "Olay",
  project_note: "Proje notu",
};

export const MEMORY_TYPE_COLORS: Record<MemoryType, string> = {
  fact: "#6366f1",
  decision: "#a855f7",
  preference: "#22c55e",
  event: "#f59e0b",
  project_note: "#06b6d4",
};

const KIND_META = {
  memory: { label: "Bellek", shape: "circle" as const },
  project: { label: "Proje", shape: "rect" as const },
  tag: { label: "Etiket", shape: "diamond" as const },
};

const CANVAS_W = 960;
const CANVAS_H = 640;

function truncate(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function runForceLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  width: number,
  height: number
): LayoutNode[] {
  if (nodes.length === 0) return nodes;

  const sim = nodes.map((n) => ({
    ...n,
    vx: 0,
    vy: 0,
    x: n.x || width / 2 + (Math.random() - 0.5) * 120,
    y: n.y || height / 2 + (Math.random() - 0.5) * 120,
  }));

  const pinned = new Set(sim.filter((n) => n.kind !== "memory").map((n) => n.id));
  const cx = width / 2;
  const cy = height / 2;

  for (let iter = 0; iter < 140; iter++) {
    const alpha = 1 - iter / 140;

    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        const a = sim[i];
        const b = sim[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy) || 0.01;
        const repulse =
          (a.kind === "memory" && b.kind === "memory" ? 4200 : 2800) / (dist * dist);
        const fx = (dx / dist) * repulse * alpha;
        const fy = (dy / dist) * repulse * alpha;
        if (!pinned.has(a.id)) {
          a.vx -= fx;
          a.vy -= fy;
        }
        if (!pinned.has(b.id)) {
          b.vx += fx;
          b.vy += fy;
        }
      }
    }

    for (const edge of edges) {
      const a = sim.find((n) => n.id === edge.from);
      const b = sim.find((n) => n.id === edge.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const ideal = edge.kind === "project" ? 110 : 72;
      const strength = 0.045 * alpha;
      const fx = (dx / dist) * (dist - ideal) * strength;
      const fy = (dy / dist) * (dist - ideal) * strength;
      if (!pinned.has(a.id)) {
        a.vx += fx;
        a.vy += fy;
      }
      if (!pinned.has(b.id)) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    for (const n of sim) {
      if (pinned.has(n.id)) continue;
      n.vx += (cx - n.x) * 0.002 * alpha;
      n.vy += (cy - n.y) * 0.002 * alpha;
      n.vx *= 0.82;
      n.vy *= 0.82;
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(48, Math.min(width - 48, n.x));
      n.y = Math.max(48, Math.min(height - 48, n.y));
    }
  }

  return sim;
}

function buildGraph(memories: BrainMemory[], projects: BrainProject[]) {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  const tagSet = new Set<string>();
  const projectIds = new Set<string>();

  const slice = memories.slice(0, 56);

  slice.forEach((m, i) => {
    const angle = (i / Math.max(slice.length, 1)) * Math.PI * 2;
    const r = 90 + (i % 4) * 18;
    nodes.push({
      id: m.id,
      label: truncate(m.content, 42),
      kind: "memory",
      memoryType: m.type,
      importance: m.importance ?? 0.5,
      x: CANVAS_W / 2 + Math.cos(angle) * r,
      y: CANVAS_H / 2 + Math.sin(angle) * r,
    });
    m.tags?.forEach((t) => tagSet.add(t));
    if (m.projectId) {
      projectIds.add(m.projectId);
      edges.push({ id: `${m.id}-p-${m.projectId}`, from: m.id, to: `proj:${m.projectId}`, kind: "project" });
    }
    m.tags?.forEach((t) => {
      edges.push({ id: `${m.id}-t-${t}`, from: m.id, to: `tag:${t}`, kind: "tag" });
    });
  });

  const projectList = projects.filter((p) => projectIds.has(p.slug || p.name)).slice(0, 12);
  projectList.forEach((p, i) => {
    const slug = p.slug || p.name;
    const angle = Math.PI + (i / Math.max(projectList.length, 1)) * Math.PI;
    nodes.push({
      id: `proj:${slug}`,
      label: slug,
      kind: "project",
      importance: 1,
      x: CANVAS_W / 2 + Math.cos(angle) * 200,
      y: 72 + (i % 2) * 24,
    });
  });

  [...tagSet].slice(0, 16).forEach((t, i) => {
    const cols = 4;
    nodes.push({
      id: `tag:${t}`,
      label: `#${t}`,
      kind: "tag",
      importance: 0.4,
      x: 80 + (i % cols) * 52,
      y: CANVAS_H - 64 - Math.floor(i / cols) * 36,
    });
  });

  const laid = runForceLayout(nodes, edges, CANVAS_W, CANVAS_H);
  return { nodes: laid, edges };
}

interface BrainGraphProps {
  memories: BrainMemory[];
  projects: BrainProject[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

export function BrainGraph({ memories, projects, selectedId, onSelect, className }: BrainGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const dragRef = useRef<{ x: number; y: number; panning: boolean } | null>(null);

  const { nodes, edges } = useMemo(
    () => buildGraph(memories, projects),
    [memories, projects]
  );

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const connected = useMemo(() => {
    const set = new Set<string>();
    if (!selectedId) return set;
    set.add(selectedId);
    edges.forEach((e) => {
      if (e.from === selectedId) set.add(e.to);
      if (e.to === selectedId) set.add(e.from);
    });
    return set;
  }, [edges, selectedId]);

  const zoomBy = useCallback((delta: number) => {
    setTransform((t) => ({
      ...t,
      k: Math.min(2.5, Math.max(0.45, t.k + delta)),
    }));
  }, []);

  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, k: 1 });
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? -0.08 : 0.08;
    zoomBy(factor);
  }, [zoomBy]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as Element).closest("[data-graph-node]")) return;
    dragRef.current = { x: e.clientX, y: e.clientY, panning: true };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d?.panning || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const unitScale = (CANVAS_W / rect.width) / transform.k;
    setTransform((t) => ({
      ...t,
      x: t.x + (e.clientX - d.x) * unitScale,
      y: t.y + (e.clientY - d.y) * unitScale,
    }));
    dragRef.current = { ...d, x: e.clientX, y: e.clientY };
  }, [transform.k]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  if (nodes.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-muted-foreground">
        Grafik için görüntülenecek bellek yok
      </div>
    );
  }

  const focusId = hoveredId || selectedId;
  const memoryTypes = Object.keys(MEMORY_TYPE_COLORS) as MemoryType[];

  return (
    <div className={cn("relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-xl border border-border/80 bg-card", className)}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {memoryTypes.map((type) => (
            <span key={type} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: MEMORY_TYPE_COLORS[type] }}
              />
              {MEMORY_TYPE_LABELS[type]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-primary" />
            Proje
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rotate-45 rounded-[1px] bg-accent" />
            Etiket
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => zoomBy(0.15)} title="Yakınlaştır">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => zoomBy(-0.15)} title="Uzaklaştır">
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={resetView} title="Görünümü sıfırla">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-[radial-gradient(circle_at_center,oklch(0.55_0.12_280/0.06)_0%,transparent_55%)] dark:bg-[radial-gradient(circle_at_center,oklch(0.55_0.12_280/0.1)_0%,transparent_55%)]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <defs>
            <pattern id="brain-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.06"
                strokeWidth="0.5"
              />
            </pattern>
            <filter id="brain-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width={CANVAS_W} height={CANVAS_H} fill="url(#brain-grid)" />

          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
            {edges.map((edge) => {
              const a = nodeMap.get(edge.from);
              const b = nodeMap.get(edge.to);
              if (!a || !b) return null;
              const active =
                !focusId || connected.has(edge.from) || connected.has(edge.to);
              return (
                <line
                  key={edge.id}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={edge.kind === "project" ? "var(--color-primary)" : "var(--color-accent)"}
                  strokeOpacity={active ? (edge.kind === "project" ? 0.35 : 0.22) : 0.06}
                  strokeWidth={active && focusId ? 1.5 : 1}
                />
              );
            })}

            {nodes.map((node) => {
              const isMemory = node.kind === "memory";
              const isSelected = isMemory && node.id === selectedId;
              const isHovered = node.id === hoveredId;
              const dimmed = focusId && !connected.has(node.id) && node.id !== focusId;
              const showLabel = isSelected || isHovered || node.kind !== "memory";
              const radius = isMemory ? 6 + node.importance * 8 : node.kind === "project" ? 11 : 7;

              const fill = isMemory
                ? MEMORY_TYPE_COLORS[node.memoryType ?? "fact"]
                : node.kind === "project"
                  ? "var(--color-primary)"
                  : "var(--color-accent)";

              return (
                <g
                  key={node.id}
                  data-graph-node={isMemory ? "" : undefined}
                  className={isMemory ? "cursor-pointer" : ""}
                  opacity={dimmed ? 0.28 : 1}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={(e) => {
                    if (isMemory) {
                      e.stopPropagation();
                      onSelect(node.id);
                    }
                  }}
                >
                  {node.kind === "project" ? (
                    <rect
                      x={node.x - radius}
                      y={node.y - radius * 0.75}
                      width={radius * 2}
                      height={radius * 1.5}
                      rx={4}
                      fill={fill}
                      fillOpacity={0.9}
                      stroke={isSelected || isHovered ? "white" : "transparent"}
                      strokeWidth={1.5}
                      filter={isSelected ? "url(#brain-glow)" : undefined}
                    />
                  ) : node.kind === "tag" ? (
                    <polygon
                      points={`${node.x},${node.y - radius} ${node.x + radius},${node.y} ${node.x},${node.y + radius} ${node.x - radius},${node.y}`}
                      fill={fill}
                      fillOpacity={0.85}
                      stroke={isHovered ? "white" : "transparent"}
                      strokeWidth={1}
                    />
                  ) : (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={radius}
                      fill={fill}
                      fillOpacity={0.92}
                      stroke={isSelected || isHovered ? "white" : "transparent"}
                      strokeWidth={isSelected ? 2 : 1.5}
                      filter={isSelected ? "url(#brain-glow)" : undefined}
                    />
                  )}

                  {showLabel && (
                    <text
                      x={node.x}
                      y={node.y + radius + 14}
                      textAnchor="middle"
                      className="fill-foreground text-[10px] font-medium"
                      style={{ pointerEvents: "none" }}
                    >
                      {truncate(node.label, node.kind === "memory" ? 28 : 18)}
                    </text>
                  )}

                  <title>
                    {KIND_META[node.kind].label}: {node.label}
                  </title>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-border/60 bg-background/80 px-2.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur-sm">
          <Maximize2 className="mr-1 inline h-3 w-3" />
          Sürükle · tekerlek ile yakınlaştır · belleğe tıkla
        </div>

        <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-border/60 bg-background/80 px-2.5 py-1.5 text-[10px] tabular-nums text-muted-foreground backdrop-blur-sm">
          {nodes.filter((n) => n.kind === "memory").length} bellek · {edges.length} bağlantı
        </div>
      </div>
    </div>
  );
}
