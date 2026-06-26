import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  GitBranch,
  Link2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectContextGraph } from "@/components/settings/ProjectContextGraph";
import { ProjectCommandCenterPanel } from "@/components/projects/ProjectCommandCenterPanel";
import { UsageQuotaPanel } from "@/components/settings/UsageQuotaPanel";
import {
  deleteProject,
  fetchProjectChanges,
  fetchProjectContext,
  fetchProjectDetail,
  syncProjectIndex,
  updateProjectLinks,
} from "@/lib/project-api";
import { getProjectEnv, getProjectId, saveProjectContext } from "@/lib/project-context";
import { subscribeWorkspaceContext } from "@/lib/workspace-context-store";
import { useToast } from "@/providers/ToastProvider";
import { cn, formatTime } from "@/lib/utils";

const ENVS = ["development", "staging", "production"] as const;

export function ProjectDetailPanel({
  projectKey,
  onDeleted,
}: {
  projectKey: string;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [activeProjectId, setActiveProjectId] = useState(() => getProjectId());
  const [activeEnv, setActiveEnv] = useState(() => getProjectEnv());
  const [workspaceEnv, setWorkspaceEnv] = useState(() => getProjectEnv());
  const [githubRepo, setGithubRepo] = useState("");
  const [backendRepo, setBackendRepo] = useState("");
  const [frontendRepo, setFrontendRepo] = useState("");
  const [mobileRepo, setMobileRepo] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [backendUrl, setBackendUrl] = useState("");
  const [frontendUrl, setFrontendUrl] = useState("");
  const [mobileUrl, setMobileUrl] = useState("");
  const [notionProjectId, setNotionProjectId] = useState("");
  const [obsidianVaultPath, setObsidianVaultPath] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");

  useEffect(() => {
    return subscribeWorkspaceContext(() => {
      setActiveProjectId(getProjectId());
      setActiveEnv(getProjectEnv());
    });
  }, []);

  const detailQuery = useQuery({
    queryKey: ["project-detail", projectKey],
    queryFn: () => fetchProjectDetail(projectKey),
    enabled: !!projectKey,
  });

  const contextQuery = useQuery({
    queryKey: ["project-context", projectKey],
    queryFn: () => fetchProjectContext(projectKey),
    enabled: !!projectKey,
  });

  const changesQuery = useQuery({
    queryKey: ["project-changes", projectKey],
    queryFn: () => fetchProjectChanges(projectKey, 14),
    enabled: !!projectKey,
  });

  useEffect(() => {
    const links = contextQuery.data?.links;
    if (!links) return;
    setGithubRepo(links.githubRepo ?? "");
    setBackendRepo(links.backendRepo ?? "");
    setFrontendRepo(links.frontendRepo ?? "");
    setMobileRepo(links.mobileRepo ?? "");
    setWebsiteUrl(links.websiteUrl ?? "");
    setBackendUrl(links.backendUrl ?? "");
    setFrontendUrl(links.frontendUrl ?? "");
    setMobileUrl(links.mobileUrl ?? "");
    setNotionProjectId(links.notionProjectId ?? "");
    setObsidianVaultPath(links.obsidianVaultPath ?? "");
    setDefaultBranch(links.defaultBranch ?? "main");
  }, [contextQuery.data?.links, projectKey]);

  const activateMutation = useMutation({
    mutationFn: () =>
      saveProjectContext({
        projectId: projectKey,
        projectEnv: workspaceEnv,
      }),
    onSuccess: () => {
      toast.show("Aktif proje güncellendi");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const linksMutation = useMutation({
    mutationFn: () =>
      updateProjectLinks(projectKey, {
        githubRepo: githubRepo.trim() || undefined,
        backendRepo: backendRepo.trim() || undefined,
        frontendRepo: frontendRepo.trim() || undefined,
        mobileRepo: mobileRepo.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        backendUrl: backendUrl.trim() || undefined,
        frontendUrl: frontendUrl.trim() || undefined,
        mobileUrl: mobileUrl.trim() || undefined,
        notionProjectId: notionProjectId.trim() || undefined,
        obsidianVaultPath: obsidianVaultPath.trim() || undefined,
        defaultBranch: defaultBranch.trim() || "main",
      }),
    onSuccess: () => {
      toast.show("Bağlantılar kaydedildi");
      qc.invalidateQueries({ queryKey: ["project-context", projectKey] });
      qc.invalidateQueries({ queryKey: ["project-detail", projectKey] });
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncProjectIndex(projectKey, 14, true),
    onSuccess: (data) => {
      toast.show(data.jobId ? `Index sync başlatıldı` : "Index sync tamamlandı");
      qc.invalidateQueries({ queryKey: ["project-context", projectKey] });
      qc.invalidateQueries({ queryKey: ["project-changes", projectKey] });
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(projectKey),
    onSuccess: () => {
      toast.show("Proje silindi");
      onDeleted();
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  if (contextQuery.isLoading && detailQuery.isLoading) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  const project = detailQuery.data?.project;
  const displayName = contextQuery.data?.project?.name ?? project?.name ?? projectKey;
  const isActive = activeProjectId === projectKey;
  const envKeys = Object.keys(project?.envs ?? {});
  const summary = changesQuery.data?.summary;

  return (
    <div className="space-y-4">
      <ProjectCommandCenterPanel projectKey={projectKey} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{displayName}</CardTitle>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{projectKey}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isActive ? (
                <Badge className="gap-1 bg-success/15 text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  Aktif · {activeEnv}
                </Badge>
              ) : (
                <Badge variant="outline">Pasif</Badge>
              )}
              {project?.createdAt && (
                <Badge variant="outline" className="text-[10px]">
                  {formatTime(project.createdAt)}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Çalışma ortamı</Label>
              <Select value={workspaceEnv} onValueChange={setWorkspaceEnv}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENVS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant={isActive ? "outline" : "default"}
              disabled={activateMutation.isPending}
              onClick={() => activateMutation.mutate()}
            >
              {isActive ? "Ortamı güncelle" : "Aktif proje yap"}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/chat`}>Sohbete git</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/runs`}>Run&apos;lar</Link>
            </Button>
          </div>
          {contextQuery.data?.lastChangeSummary && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {contextQuery.data.lastChangeSummary}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4" />
              Bağlantılar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs font-medium text-muted-foreground">Web</p>
            <div className="space-y-1">
              <Label>Web sitesi URL</Label>
              <Input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <p className="text-xs font-medium text-muted-foreground">Servis URL&apos;leri</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Backend (API)</Label>
                <Input
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  placeholder="https://api.example.com"
                />
              </div>
              <div className="space-y-1">
                <Label>Frontend (web app)</Label>
                <Input
                  value={frontendUrl}
                  onChange={(e) => setFrontendUrl(e.target.value)}
                  placeholder="https://app.example.com"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Mobil (store / deep link)</Label>
                <Input
                  value={mobileUrl}
                  onChange={(e) => setMobileUrl(e.target.value)}
                  placeholder="https://apps.apple.com/… veya myapp://"
                />
              </div>
            </div>

            <p className="text-xs font-medium text-muted-foreground">Git repoları</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Ana repo (monorepo)</Label>
                <Input
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="owner/repo"
                />
              </div>
              <div className="space-y-1">
                <Label>Backend repo</Label>
                <Input
                  value={backendRepo}
                  onChange={(e) => setBackendRepo(e.target.value)}
                  placeholder="owner/api"
                />
              </div>
              <div className="space-y-1">
                <Label>Frontend repo</Label>
                <Input
                  value={frontendRepo}
                  onChange={(e) => setFrontendRepo(e.target.value)}
                  placeholder="owner/web"
                />
              </div>
              <div className="space-y-1">
                <Label>Mobil repo</Label>
                <Input
                  value={mobileRepo}
                  onChange={(e) => setMobileRepo(e.target.value)}
                  placeholder="owner/mobile"
                />
              </div>
              <div className="space-y-1">
                <Label>Varsayılan branch</Label>
                <Input value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value)} />
              </div>
            </div>

            <p className="text-xs font-medium text-muted-foreground">Entegrasyonlar</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Notion proje DB</Label>
                <Input
                  value={notionProjectId}
                  onChange={(e) => setNotionProjectId(e.target.value)}
                  placeholder="database-id"
                />
              </div>
              <div className="space-y-1">
                <Label>Obsidian vault</Label>
                <Input
                  value={obsidianVaultPath}
                  onChange={(e) => setObsidianVaultPath(e.target.value)}
                  placeholder="/path/to/vault"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={linksMutation.isPending} onClick={() => linksMutation.mutate()}>
                Kaydet
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={syncMutation.isPending}
                onClick={() => syncMutation.mutate()}
              >
                <RefreshCw className={cn("mr-1 h-3.5 w-3.5", syncMutation.isPending && "animate-spin")} />
                Index sync
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Özet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Graph düğüm" value={contextQuery.data?.graph?.nodes?.length ?? 0} />
              <Stat label="Son run" value={contextQuery.data?.recentRuns?.length ?? 0} />
              <Stat label="Olay (14g)" value={summary?.eventCount ?? changesQuery.data?.events?.length ?? 0} />
              <Stat label="Env profili" value={envKeys.length} />
            </div>
            {envKeys.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {envKeys.map((e) => (
                  <Badge key={e} variant="outline" className="font-mono text-[10px]">
                    {e}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {contextQuery.data?.graph && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Context graph</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectContextGraph
              nodes={contextQuery.data.graph.nodes}
              edges={contextQuery.data.graph.edges ?? []}
              lastChangeSummary={undefined}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4" />
              Son run&apos;lar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(contextQuery.data?.recentRuns ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz run yok.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {contextQuery.data!.recentRuns.slice(0, 8).map((run) => (
                  <li key={run.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2">
                    <span className="line-clamp-1">{run.goal || run.id}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {run.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Son olaylar</CardTitle>
          </CardHeader>
          <CardContent>
            {(contextQuery.data?.recentEvents ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz olay yok.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {contextQuery.data!.recentEvents.slice(0, 8).map((ev) => (
                  <li key={ev.id} className="rounded-lg border border-border/50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {ev.eventType}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{formatTime(ev.occurredAt)}</span>
                    </div>
                    {ev.summary && <p className="mt-1 line-clamp-2 text-muted-foreground">{ev.summary}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <UsageQuotaPanel projectId={projectKey} />

      <Card className="border-destructive/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-destructive">Tehlikeli bölge</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Projeyi kalıcı olarak siler. Danger scope API anahtarı gerekir.
          </p>
          <Button
            size="sm"
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (confirm(`"${displayName}" silinsin mi?`)) deleteMutation.mutate();
            }}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Projeyi sil
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
