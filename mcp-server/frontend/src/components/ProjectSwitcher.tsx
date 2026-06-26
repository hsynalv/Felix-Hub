import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchProjectsList } from "@/lib/project-api";
import { getProjectEnv, getProjectId, saveProjectContext } from "@/lib/project-context";
import { subscribeWorkspaceContext } from "@/lib/workspace-context-store";
import { cn } from "@/lib/utils";

const ENVS = ["development", "staging", "production"] as const;

export function ProjectSwitcher({ className }: { className?: string }) {
  const [projectId, setProjectIdState] = useState(() => getProjectId());
  const [projectEnv, setProjectEnvState] = useState(() => getProjectEnv());
  const qc = useQueryClient();

  const { data: projectsData } = useQuery({
    queryKey: ["projects-list"],
    queryFn: fetchProjectsList,
    staleTime: 60_000,
  });

  const projects = projectsData?.projects ?? [];

  useEffect(() => {
    return subscribeWorkspaceContext(() => {
      setProjectIdState(getProjectId());
      setProjectEnvState(getProjectEnv());
    });
  }, []);

  const saveMutation = useMutation({
    mutationFn: saveProjectContext,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["project-context"] });
    },
  });

  const apply = (next: { projectId?: string; projectEnv?: string }) => {
    const pid = (next.projectId ?? projectId).trim() || "default";
    const env = (next.projectEnv ?? projectEnv).trim() || "development";
    setProjectIdState(pid);
    setProjectEnvState(env);
    saveMutation.mutate({ projectId: pid, projectEnv: env });
  };

  const projectOptions = useMemo(() => {
    const raw =
      projects.length > 0 ? projects : [{ key: projectId, name: projectId }];
    const nameCounts = new Map<string, number>();
    for (const p of raw) {
      const label = p.name || p.key;
      nameCounts.set(label, (nameCounts.get(label) ?? 0) + 1);
    }
    return raw.map((p) => {
      const label = p.name || p.key;
      const duplicateName = (nameCounts.get(label) ?? 0) > 1;
      return {
        ...p,
        displayName: duplicateName ? `${label} (${p.key})` : label,
      };
    });
  }, [projects, projectId]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <FolderKanban className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
      <Select value={projectId} onValueChange={(v) => apply({ projectId: v })}>
        <SelectTrigger className="h-8 w-[min(140px,32vw)] rounded-lg border-border/60 bg-card/60 text-xs">
          <SelectValue placeholder="Proje" />
        </SelectTrigger>
        <SelectContent>
          {projectOptions.map((p) => (
            <SelectItem key={p.key} value={p.key}>
              {p.displayName ?? (p.name || p.key)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={projectEnv} onValueChange={(v) => apply({ projectEnv: v })}>
        <SelectTrigger className="h-8 w-[min(110px,28vw)] rounded-lg border-border/60 bg-card/60 text-xs">
          <SelectValue placeholder="Ortam" />
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
  );
}
