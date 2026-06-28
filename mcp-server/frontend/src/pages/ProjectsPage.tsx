import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { ProjectDetailPanel } from "@/components/projects/ProjectDetailPanel";
import { fetchProjectsList } from "@/lib/project-api";
import { getProjectId } from "@/lib/project-context";
import { subscribeWorkspaceContext } from "@/lib/workspace-context-store";
import { cn } from "@/lib/utils";

export function ProjectsPage() {
  const { projectKey: routeKey } = useParams<{ projectKey?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedKey, setSelectedKey] = useState(routeKey ?? getProjectId());
  const [activeId, setActiveId] = useState(() => getProjectId());
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["projects-list"],
    queryFn: fetchProjectsList,
    staleTime: 30_000,
    retry: 2,
  });

  const projects = data?.projects ?? [];

  const sorted = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );

  const selectProject = (key: string) => {
    setSelectedKey(key);
    navigate(`/projects/${encodeURIComponent(key)}`, { replace: true });
  };

  useEffect(() => {
    return subscribeWorkspaceContext(() => setActiveId(getProjectId()));
  }, []);

  useEffect(() => {
    if (routeKey) setSelectedKey(routeKey);
  }, [routeKey]);

  useEffect(() => {
    if (routeKey || isLoading || sorted.length === 0) return;
    if (!sorted.some((p) => p.key === selectedKey)) {
      selectProject(sorted[0].key);
    }
  }, [isLoading, sorted, routeKey, selectedKey]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["projects-list"] });
    qc.invalidateQueries({ queryKey: ["plugins"] });
  };

  const handleCreated = (key: string) => {
    invalidate();
    selectProject(key);
  };

  const handleDeleted = () => {
    invalidate();
    const fallback = sorted.find((p) => p.key !== selectedKey)?.key ?? "default";
    selectProject(fallback);
  };

  const selectedExists = sorted.some((p) => p.key === selectedKey);

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 space-y-3 lg:w-72">
        <PageHeader
          title="Projeler"
          description="Oluştur, bağlantıları yönet ve context graph&apos;ı görüntüle"
          actions={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Yeni
            </Button>
          }
        />

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <Card className="border-destructive/30">
            <CardContent className="space-y-3 py-8 text-center text-sm">
              <p className="font-medium text-destructive">Projeler yüklenemedi</p>
              <p className="text-muted-foreground">{(error as Error).message}</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                Tekrar dene
              </Button>
            </CardContent>
          </Card>
        ) : sorted.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <FolderKanban className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Henüz proje yok. Yeni proje ile başlayın.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {sorted.map((p) => {
              const selected = p.key === selectedKey;
              const active = p.key === activeId;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => selectProject(p.key)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                    selected
                      ? "border-primary/50 bg-primary/10"
                      : "border-border/60 bg-card/60 hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground">{p.key}</p>
                    </div>
                    {active && (
                      <Badge className="shrink-0 text-[10px] bg-success/15 text-success">
                        aktif
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1">
        {selectedKey && (selectedExists || !isLoading) ? (
          selectedExists ? (
            <ProjectDetailPanel projectKey={selectedKey} onDeleted={handleDeleted} />
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Proje bulunamadı: <span className="font-mono">{selectedKey}</span>
              </CardContent>
            </Card>
          )
        ) : (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Listeden bir proje seçin veya yeni proje oluşturun.
            </CardContent>
          </Card>
        )}
      </main>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={handleCreated} />
    </div>
  );
}
