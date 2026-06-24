import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Brain, KeyRound, Loader2, Plus, Search, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrainGraph } from "@/components/BrainGraph";
import { getApiKey } from "@/lib/auth";
import {
  createMemory,
  deleteMemory,
  fetchBrainProfile,
  fetchBrainStats,
  fetchMemories,
  fetchMemory,
  fetchObsidianStatus,
  fetchProjects,
  recallMemories,
  syncObsidian,
  updateMemory,
  type MemoryType,
} from "@/lib/brain-api";
import { useToast } from "@/providers/ToastProvider";
import { cn, formatTime } from "@/lib/utils";

const MEMORY_TYPES: MemoryType[] = ["fact", "decision", "preference", "event", "project_note"];

export function BrainPage() {
  const [hasApiKey, setHasApiKey] = useState(() => !!getApiKey());
  const [search, setSearch] = useState("");
  const [semantic, setSemantic] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<MemoryType>("fact");
  const [view, setView] = useState<"list" | "graph">("list");

  const toast = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    const sync = () => setHasApiKey(!!getApiKey());
    sync();
    const t = setInterval(sync, 1500);
    return () => clearInterval(t);
  }, []);

  const { data: stats } = useQuery({
    queryKey: ["brain-stats"],
    queryFn: fetchBrainStats,
    enabled: hasApiKey,
  });

  const { data: profile } = useQuery({
    queryKey: ["brain-profile"],
    queryFn: fetchBrainProfile,
    enabled: hasApiKey,
  });

  const { data: projectsData } = useQuery({
    queryKey: ["brain-projects"],
    queryFn: fetchProjects,
    enabled: hasApiKey,
  });

  const { data: obsidian } = useQuery({
    queryKey: ["brain-obsidian"],
    queryFn: fetchObsidianStatus,
    enabled: hasApiKey,
  });

  const listQuery = useQuery({
    queryKey: ["brain-memories", typeFilter, tagFilter, projectFilter, semantic ? search : ""],
    queryFn: async () => {
      if (semantic && search.trim()) {
        const data = await recallMemories({
          query: search.trim(),
          type: (typeFilter as MemoryType) || undefined,
          projectId: projectFilter || undefined,
          tags: tagFilter ? [tagFilter] : undefined,
          limit: 50,
        });
        return { total: data.total, memories: data.memories };
      }
      return fetchMemories({
        type: typeFilter || undefined,
        projectId: projectFilter || undefined,
        tags: tagFilter || undefined,
        limit: 100,
      });
    },
    enabled: hasApiKey,
  });

  const memories = listQuery.data?.memories ?? [];

  const filteredMemories = useMemo(() => {
    if (semantic || !search.trim()) return memories;
    const q = search.toLowerCase();
    return memories.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [memories, search, semantic]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    memories.forEach((m) => m.tags?.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [memories]);

  const { data: selected } = useQuery({
    queryKey: ["brain-memory", selectedId],
    queryFn: () => fetchMemory(selectedId!),
    enabled: !!selectedId && hasApiKey,
  });

  const related = useMemo(() => {
    if (!selected) return [];
    return memories.filter(
      (m) =>
        m.id !== selected.id &&
        ((selected.projectId && m.projectId === selected.projectId) ||
          selected.tags?.some((t) => m.tags?.includes(t)))
    ).slice(0, 8);
  }, [memories, selected]);

  const saveMutation = useMutation({
    mutationFn: () => updateMemory(selectedId!, { content: editContent }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brain-memories"] });
      qc.invalidateQueries({ queryKey: ["brain-memory", selectedId] });
      setEditing(false);
      toast.show("Bellek güncellendi");
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Hata", "error"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createMemory({
        content: newContent.trim(),
        type: newType,
        tags: tagFilter ? [tagFilter] : [],
        projectId: projectFilter || null,
      }),
    onSuccess: (mem) => {
      qc.invalidateQueries({ queryKey: ["brain-memories"] });
      qc.invalidateQueries({ queryKey: ["brain-stats"] });
      setNewOpen(false);
      setNewContent("");
      setSelectedId(mem.id);
      toast.show("Bellek oluşturuldu");
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Hata", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMemory(selectedId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brain-memories"] });
      qc.invalidateQueries({ queryKey: ["brain-stats"] });
      setSelectedId(null);
      toast.show("Bellek silindi");
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Hata", "error"),
  });

  const obsidianSync = useMutation({
    mutationFn: syncObsidian,
    onSuccess: (d) => toast.show(`Obsidian sync: ${d.synced} bellek`),
    onError: (e) => toast.show(e instanceof Error ? e.message : "Sync hatası", "error"),
  });

  const selectMemory = useCallback((id: string) => {
    setSelectedId(id);
    setEditing(false);
  }, []);

  useEffect(() => {
    if (selected) setEditContent(selected.content);
  }, [selected]);

  const projects = projectsData?.projects ?? [];

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Brain className="h-5 w-5 text-primary" />
            Brain Memory
          </h1>
          <p className="text-xs text-muted-foreground">
            {stats?.total ?? "—"} bellek · {projects.length} proje
            {profile && Object.keys(profile).length > 0 && " · profil yüklü"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {obsidian?.enabled && (
            <Button
              variant="outline"
              size="sm"
              disabled={obsidianSync.isPending}
              onClick={() => obsidianSync.mutate()}
            >
              {obsidianSync.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1 h-4 w-4" />
              )}
              Obsidian sync
            </Button>
          )}
          <Button size="sm" onClick={() => setNewOpen(true)} disabled={!hasApiKey}>
            <Plus className="mr-1 h-4 w-4" />
            Yeni bellek
          </Button>
        </div>
      </div>

      {!hasApiKey && (
        <div className="flex shrink-0 items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium">Kimlik doğrulama gerekli</p>
            <p className="text-muted-foreground">
              Üst bardan Token veya API key kaydet.{" "}
              <Link to="/settings" className="text-primary underline-offset-2 hover:underline">
                Settings
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[220px_1fr_320px]">
        {/* Filters */}
        <Card className="flex flex-col gap-3 p-3 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Arama</label>
            <div className="flex gap-1">
              <Input
                placeholder="Ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!hasApiKey}
              />
              <Button
                variant={semantic ? "default" : "outline"}
                size="icon"
                title="Semantic recall"
                onClick={() => setSemantic((s) => !s)}
                disabled={!hasApiKey}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {semantic && (
              <p className="text-[10px] text-muted-foreground">Semantic: POST /brain/recall</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tip</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">Tümü</option>
              {MEMORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tag</label>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">Tümü</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Proje</label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">Tümü</option>
              {projects.map((p) => (
                <option key={p.slug || p.name} value={p.slug || p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as "list" | "graph")}>
            <TabsList className="w-full">
              <TabsTrigger value="list" className="flex-1">
                Liste
              </TabsTrigger>
              <TabsTrigger value="graph" className="flex-1">
                Graph
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Card>

        {/* List / Graph */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          {view === "graph" ? (
            <CardContent className="p-3">
              <BrainGraph
                memories={filteredMemories}
                projects={projects}
                selectedId={selectedId}
                onSelect={selectMemory}
              />
            </CardContent>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {listQuery.isLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Yükleniyor…</p>
              ) : filteredMemories.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Bellek yok</p>
              ) : (
                <ul className="space-y-2">
                  {filteredMemories.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => selectMemory(m.id)}
                        className={cn(
                          "w-full rounded-lg border border-border p-3 text-left text-sm transition-colors hover:bg-muted/50",
                          selectedId === m.id && "border-primary/50 bg-primary/10"
                        )}
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-1">
                          <Badge>{m.type}</Badge>
                          {m.projectId && (
                            <Badge variant="warning">{m.projectId}</Badge>
                          )}
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {formatTime(m.createdAt)}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-foreground">{m.content}</p>
                        {m.tags && m.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {m.tags.slice(0, 4).map((t) => (
                              <span key={t} className="text-[10px] text-muted-foreground">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>

        {/* Detail */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="text-sm">Detay</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Bellek seçin</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1">
                  <Badge>{selected.type}</Badge>
                  <Badge>imp {(selected.importance ?? 0).toFixed(2)}</Badge>
                  {selected.projectId && <Badge variant="warning">{selected.projectId}</Badge>}
                </div>
                {editing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={10}
                    className="w-full rounded-lg border border-border bg-background p-2 font-mono text-sm"
                  />
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.content}</ReactMarkdown>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {editing ? (
                    <>
                      <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                        Kaydet
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                        İptal
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                        Düzenle
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <Link to={`/chat?prompt=${encodeURIComponent(`Bu bellek hakkında: ${selected.content.slice(0, 200)}`)}`}>
                          Chat&apos;te sor
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteMutation.mutate()}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                {related.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">İlgili bellekler</p>
                    <ul className="space-y-1">
                      {related.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            className="text-left text-xs text-primary hover:underline"
                            onClick={() => selectMemory(r.id)}
                          >
                            {r.content.slice(0, 60)}…
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni bellek</DialogTitle>
          </DialogHeader>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as MemoryType)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {MEMORY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={6}
            placeholder="Markdown desteklenir…"
            className="w-full rounded-lg border border-border bg-background p-2 text-sm"
          />
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!newContent.trim() || createMutation.isPending}
          >
            Oluştur
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
