import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fetchProjectContext } from "@/lib/project-api";
import { getProjectId } from "@/lib/project-context";
import type { WorkflowTemplate } from "@/lib/runs-api";
import { useQuery } from "@tanstack/react-query";

export function WorkflowTemplateDialog({
  template,
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: {
  template: WorkflowTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (params: Record<string, string>, dryRun: boolean) => void;
  submitting?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [dryRun, setDryRun] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const projectId = getProjectId();
  const contextQuery = useQuery({
    queryKey: ["project-context-presets", projectId],
    queryFn: () => fetchProjectContext(projectId),
    enabled: open && !!template,
  });

  const defaults = useMemo(() => {
    const d: Record<string, string> = {};
    for (const p of template?.parameters ?? []) {
      if (p.default != null) d[p.name] = String(p.default);
    }
    const links = contextQuery.data?.links;
    if (links?.githubRepo && !d.repo) d.repo = links.githubRepo;
    if (links?.defaultBranch && !d.baseBranch) d.baseBranch = links.defaultBranch;
    if (template?.id === "repo-ship-feature" && !d.branch) d.branch = "feature/agent-run";
    return d;
  }, [template, contextQuery.data?.links]);

  useEffect(() => {
    if (!open || !template) return;
    setValues(defaults);
    setErrors({});
    setDryRun(true);
  }, [open, template, defaults]);

  if (!template) return null;

  const validate = () => {
    const next: Record<string, string> = {};
    for (const p of template.parameters) {
      if (p.required && !values[p.name]?.trim()) {
        next[p.name] = "Zorunlu alan";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit(values, dryRun);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {template.parameters.map((p) => (
            <div key={p.name} className="space-y-1.5">
              <Label htmlFor={`wf-${p.name}`}>
                {p.name}
                {p.required ? " *" : ""}
              </Label>
              <Input
                id={`wf-${p.name}`}
                value={values[p.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                placeholder={p.description || p.name}
              />
              {p.description && (
                <p className="text-xs text-muted-foreground">{p.description}</p>
              )}
              {errors[p.name] && (
                <p className="text-xs text-destructive">{errors[p.name]}</p>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Dry-run</p>
              <p className="text-xs text-muted-foreground">Araçları simüle et, yan etki yok</p>
            </div>
            <Switch checked={dryRun} onCheckedChange={setDryRun} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Başlat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
