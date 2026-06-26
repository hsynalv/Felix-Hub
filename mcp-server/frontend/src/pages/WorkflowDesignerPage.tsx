import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OpsPageHero, OpsPageShell, OpsPanel } from "@/components/ops/OpsPrimitives";
import {
  listToolsForDesigner,
  previewWorkflowTemplate,
  saveWorkflowTemplate,
  getWorkflowTemplate,
  type WorkflowDraft,
  type WorkflowStep,
} from "@/lib/workflows-api";
import { useToast } from "@/providers/ToastProvider";

const emptyDraft = (): WorkflowDraft => ({
  name: "Yeni workflow",
  description: "",
  parameters: [],
  steps: [{ type: "tool", toolName: "", args: {} }],
});

export function WorkflowDesignerPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<WorkflowDraft>(emptyDraft());
  const [selectedStep, setSelectedStep] = useState(0);
  const [previewJson, setPreviewJson] = useState("");

  const { data: toolsData } = useQuery({ queryKey: ["designer-tools"], queryFn: listToolsForDesigner });
  const tools = toolsData?.tools ?? [];

  useEffect(() => {
    if (!id) return;
    void getWorkflowTemplate(id).then(setDraft).catch(() => toast.show("Template yüklenemedi", "error"));
  }, [id, toast]);

  const saveMutation = useMutation({
    mutationFn: () => saveWorkflowTemplate(draft),
    onSuccess: (saved) => {
      toast.show("Workflow kaydedildi", "info");
      qc.invalidateQueries({ queryKey: ["workflow-templates"] });
      if (!id && saved.id) navigate(`/workflows/designer/${saved.id}`, { replace: true });
      setDraft(saved);
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const previewMutation = useMutation({
    mutationFn: () => {
      const tid = draft.id || id;
      if (!tid) throw new Error("Önce kaydedin");
      const params: Record<string, string> = {};
      for (const p of draft.parameters) {
        if (p.default) params[p.name] = p.default;
      }
      return previewWorkflowTemplate(tid, params, true);
    },
    onSuccess: (data) => setPreviewJson(JSON.stringify(data.plan ?? data, null, 2)),
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const step = draft.steps[selectedStep] ?? draft.steps[0];

  const updateStep = (patch: Partial<WorkflowStep>) => {
    const steps = [...draft.steps];
    steps[selectedStep] = { ...steps[selectedStep], ...patch };
    setDraft({ ...draft, steps });
  };

  return (
    <OpsPageShell>
      <OpsPageHero icon={Wand2} title="Workflow Designer" description="Görsel agent workflow tasarımı (V4)" />
      <div className="mb-4 flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/runs">Runs</Link>
        </Button>
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || draft.readonly}>
          Kaydet
        </Button>
        <Button variant="secondary" size="sm" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
          Dry-run önizleme
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <OpsPanel title="Adımlar" className="lg:col-span-1">
          <div className="space-y-1">
            {draft.steps.map((s, i) => (
              <button
                key={i}
                type="button"
                className={`w-full rounded-md border px-2 py-1.5 text-left text-sm ${i === selectedStep ? "border-primary bg-muted" : ""}`}
                onClick={() => setSelectedStep(i)}
              >
                {i + 1}. {s.type}
                {s.toolName ? ` — ${s.toolName}` : ""}
              </button>
            ))}
          </div>
          <Button
            className="mt-3 w-full"
            variant="outline"
            size="sm"
            onClick={() => setDraft({ ...draft, steps: [...draft.steps, { type: "tool", toolName: "", args: {} }] })}
          >
            Adım ekle
          </Button>
        </OpsPanel>

        <OpsPanel title="Step Inspector" className="lg:col-span-1">
          <div className="space-y-3">
            <div>
              <Label>Workflow adı</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <Label>Açıklama</Label>
              <Textarea value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div>
              <Label>Step tipi</Label>
              <Select value={step?.type || "tool"} onValueChange={(v) => updateStep({ type: v as WorkflowStep["type"] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tool">tool</SelectItem>
                  <SelectItem value="checkpoint">checkpoint</SelectItem>
                  <SelectItem value="approval">approval</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {step?.type === "tool" && (
              <>
                <div>
                  <Label>Tool</Label>
                  <Select value={step.toolName || ""} onValueChange={(v) => updateStep({ toolName: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tool seç" />
                    </SelectTrigger>
                    <SelectContent>
                      {tools.map((t) => (
                        <SelectItem key={t.name} value={t.name}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Args (JSON)</Label>
                  <Textarea
                    rows={4}
                    value={JSON.stringify(step.args || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        updateStep({ args: JSON.parse(e.target.value) });
                      } catch {
                        /* ignore while typing */
                      }
                    }}
                  />
                </div>
                <div>
                  <Label>When (opsiyonel)</Label>
                  <Input value={step.when || ""} onChange={(e) => updateStep({ when: e.target.value || undefined })} placeholder='dryRun === false' />
                </div>
              </>
            )}
          </div>
        </OpsPanel>

        <OpsPanel title="Önizleme" className="lg:col-span-1">
          <pre className="max-h-96 overflow-auto rounded-md bg-muted p-2 text-xs">{previewJson || "Dry-run ile plan görünür"}</pre>
        </OpsPanel>
      </div>
    </OpsPageShell>
  );
}