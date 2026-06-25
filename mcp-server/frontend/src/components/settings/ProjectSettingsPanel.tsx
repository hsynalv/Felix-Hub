import { FolderKanban, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsInfoBox, SettingsSectionCard } from "@/components/settings/shared";
import { ProjectContextGraph } from "@/components/settings/ProjectContextGraph";
import { fetchProjectContext, updateProjectLinks, syncProjectIndex } from "@/lib/project-api";
import { getProjectEnv, getProjectId, saveProjectContext } from "@/lib/project-context";
import { subscribeWorkspaceContext } from "@/lib/workspace-context-store";
import { useToast } from "@/providers/ToastProvider";

export function ProjectSettingsPanel() {
  const [projectId, setProjectIdState] = useState(() => getProjectId());
  const [projectEnv, setProjectEnvState] = useState(() => getProjectEnv());
  const [githubRepo, setGithubRepo] = useState("");
  const [notionProjectId, setNotionProjectId] = useState("");
  const [obsidianVaultPath, setObsidianVaultPath] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const toast = useToast();
  const queryClient = useQueryClient();

  const contextQuery = useQuery({
    queryKey: ["project-context", projectId],
    queryFn: () => fetchProjectContext(projectId.trim() || "default"),
    enabled: !!projectId.trim(),
  });

  useEffect(() => {
    const links = contextQuery.data?.links;
    if (!links) return;
    if (links.githubRepo) setGithubRepo(links.githubRepo);
    if (links.notionProjectId) setNotionProjectId(links.notionProjectId);
    if (links.obsidianVaultPath) setObsidianVaultPath(links.obsidianVaultPath);
    if (links.defaultBranch) setDefaultBranch(links.defaultBranch);
  }, [contextQuery.data?.links]);

  useEffect(() => {
    return subscribeWorkspaceContext(() => {
      setProjectIdState(getProjectId());
      setProjectEnvState(getProjectEnv());
    });
  }, []);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveProjectContext({
        projectId: projectId.trim() || "default",
        projectEnv: projectEnv.trim() || "development",
      }),
    onSuccess: () => {
      toast.show("Proje ayarları kaydedildi");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const linksMutation = useMutation({
    mutationFn: () =>
      updateProjectLinks(projectId.trim() || "default", {
        githubRepo: githubRepo.trim() || undefined,
        notionProjectId: notionProjectId.trim() || undefined,
        obsidianVaultPath: obsidianVaultPath.trim() || undefined,
        defaultBranch: defaultBranch.trim() || "main",
      }),
    onSuccess: () => {
      toast.show("Proje bağlantıları kaydedildi");
      queryClient.invalidateQueries({ queryKey: ["project-context"] });
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncProjectIndex(projectId.trim() || "default", 14, true),
    onSuccess: (data) => {
      toast.show(data.jobId ? `Index sync başlatıldı (${data.jobId.slice(0, 8)}…)` : "Index sync tamamlandı");
      queryClient.invalidateQueries({ queryKey: ["project-context"] });
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const graphNodes = contextQuery.data?.graph?.nodes?.length ?? 0;
  const graphEdges = contextQuery.data?.graph?.edges ?? [];

  return (
    <div className="space-y-6">
      <SettingsSectionCard
        icon={FolderKanban}
        title="Proje"
        description="Hub'ın hangi proje ve ortam için çalışacağını tanımlar. Sohbet, bellek ve araç çağrıları bu bağlama göre yönlendirilir."
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Proje adı</Label>
              <Input
                value={projectId}
                onChange={(e) => setProjectIdState(e.target.value)}
                placeholder="default"
              />
              <p className="text-xs text-muted-foreground">Birden fazla proje yönetiyorsanız ayırt etmek için kullanın.</p>
            </div>
            <div className="space-y-2">
              <Label>Ortam</Label>
              <Select value={projectEnv} onValueChange={setProjectEnvState}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Geliştirme</SelectItem>
                  <SelectItem value="staging">Test</SelectItem>
                  <SelectItem value="production">Canlı</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Geliştirme, test veya canlı ortam seçin.</p>
            </div>
          </div>

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Kaydet
          </Button>

          {graphNodes > 0 && (
            <p className="text-xs text-muted-foreground">
              Context graph: {graphNodes} düğüm · {graphEdges.length} bağlantı ·{" "}
              {contextQuery.data?.recentRuns?.length ?? 0} son run
            </p>
          )}

          <SettingsInfoBox variant="tip" title="Sunucuda saklanır">
            Proje ve ortam tercihiniz hub veritabanında saklanır. Aynı API anahtarıyla farklı
            cihazlardan giriş yaptığınızda ayarlarınız senkron kalır.
          </SettingsInfoBox>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        icon={Link2}
        title="Proje bağlantıları"
        description="GitHub, Notion ve Obsidian vault bağlantıları context graph ve araç yönlendirmesi için kullanılır."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>GitHub repo</Label>
            <Input
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              placeholder="owner/repo"
            />
          </div>
          <div className="space-y-2">
            <Label>Notion proje DB</Label>
            <Input
              value={notionProjectId}
              onChange={(e) => setNotionProjectId(e.target.value)}
              placeholder="database-id"
            />
          </div>
          <div className="space-y-2">
            <Label>Obsidian vault yolu</Label>
            <Input
              value={obsidianVaultPath}
              onChange={(e) => setObsidianVaultPath(e.target.value)}
              placeholder="/path/to/vault"
            />
          </div>
          <div className="space-y-2">
            <Label>Varsayılan branch</Label>
            <Input value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value)} placeholder="main" />
          </div>
          <Button onClick={() => linksMutation.mutate()} disabled={linksMutation.isPending}>
            Bağlantıları kaydet
          </Button>
          <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            Index sync (GitHub + Vault)
          </Button>
        </div>
      </SettingsSectionCard>

      {contextQuery.data?.graph && (
        <SettingsSectionCard title="Context graph" description="Proje ilişkileri ve son değişiklik özeti">
          <ProjectContextGraph
            nodes={contextQuery.data.graph.nodes}
            edges={contextQuery.data.graph.edges ?? []}
            lastChangeSummary={contextQuery.data.lastChangeSummary}
          />
        </SettingsSectionCard>
      )}
    </div>
  );
}
