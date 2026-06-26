import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  ChevronRight,
  Copy,
  Flag,
  Layers,
  Play,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  OpsCodeBlock,
  OpsHelpPanel,
  OpsPageHero,
  OpsPageShell,
  OpsPanel,
  OpsStatCard,
  OpsStatGrid,
} from "@/components/ops/OpsPrimitives";
import {
  deleteWorkflowTemplate,
  getWorkflowTemplate,
  listToolsForDesigner,
  listWorkflowTemplatesFull,
  previewWorkflowTemplate,
  saveWorkflowTemplate,
  type WorkflowDraft,
  type WorkflowStep,
} from "@/lib/workflows-api";
import { useToast } from "@/providers/ToastProvider";
import { cn } from "@/lib/utils";

type WorkflowParam = WorkflowDraft["parameters"][number];

const emptyDraft = (): WorkflowDraft => ({
  name: "Yeni workflow",
  description: "",
  parameters: [],
  steps: [{ type: "tool", toolName: "", args: {} }],
});

function stepIcon(type: WorkflowStep["type"]) {
  if (type === "tool") return Bot;
  if (type === "approval") return ShieldCheck;
  if (type === "checkpoint") return Flag;
  return Layers;
}

function summarizeSteps(steps: WorkflowStep[]) {
  return steps
    .map((s, i) => {
      const label = s.type === "tool" ? s.toolName || "(tool seçilmedi)" : s.name || s.type;
      return `${i + 1}. ${s.type} — ${label}`;
    })
    .join("\n");
}

export function WorkflowDesignerPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<WorkflowDraft>(emptyDraft());
  const [selectedStep, setSelectedStep] = useState(0);
  const [previewJson, setPreviewJson] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");

  const templatesQuery = useQuery({
    queryKey: ["workflow-templates"],
    queryFn: listWorkflowTemplatesFull,
  });

  const { data: toolsData, isLoading: toolsLoading } = useQuery({
    queryKey: ["designer-tools"],
    queryFn: listToolsForDesigner,
  });
  const tools = toolsData?.tools ?? [];

  const toolOptions = useMemo(
    () =>
      tools.map((t) => ({
        value: t.name,
        label: t.name,
        description: t.description,
        meta: t.plugin,
      })),
    [tools]
  );

  const filteredTemplates = useMemo(() => {
    const list = templatesQuery.data?.templates ?? [];
    const q = templateSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.id?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
    );
  }, [templatesQuery.data?.templates, templateSearch]);

  useEffect(() => {
    if (!id) return;
    void getWorkflowTemplate(id)
      .then((t) => {
        setDraft(t);
        setSelectedStep(0);
        setPreviewJson("");
      })
      .catch(() => toast.show("Template yüklenemedi", "error"));
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
      if (!tid) throw new Error("Önce kaydedin veya bir şablon seçin");
      const params: Record<string, string> = {};
      for (const p of draft.parameters) {
        if (p.default) params[p.name] = p.default;
      }
      return previewWorkflowTemplate(tid, params, true);
    },
    onSuccess: (data) => setPreviewJson(JSON.stringify(data.plan ?? data, null, 2)),
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!draft.id || draft.builtin) throw new Error("Builtin şablon silinemez");
      return deleteWorkflowTemplate(draft.id);
    },
    onSuccess: () => {
      toast.show("Şablon silindi");
      qc.invalidateQueries({ queryKey: ["workflow-templates"] });
      navigate("/workflows/designer");
      setDraft(emptyDraft());
      setSelectedStep(0);
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const step = draft.steps[selectedStep] ?? draft.steps[0];
  const isReadonly = !!draft.readonly || !!draft.builtin;
  const toolStepCount = draft.steps.filter((s) => s.type === "tool").length;

  const updateStep = (patch: Partial<WorkflowStep>) => {
    const steps = [...draft.steps];
    steps[selectedStep] = { ...steps[selectedStep], ...patch };
    setDraft({ ...draft, steps });
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[index], steps[next]] = [steps[next], steps[index]];
    setDraft({ ...draft, steps });
    setSelectedStep(next);
  };

  const removeStep = (index: number) => {
    if (draft.steps.length <= 1) return;
    const steps = draft.steps.filter((_, i) => i !== index);
    setDraft({ ...draft, steps });
    setSelectedStep(Math.max(0, index - 1));
  };

  const loadTemplate = async (template: WorkflowDraft) => {
    if (!template.id) return;
    if (!template.builtin) {
      navigate(`/workflows/designer/${template.id}`);
      return;
    }
    try {
      const full = await getWorkflowTemplate(template.id);
      setDraft(full);
      setSelectedStep(0);
      setPreviewJson("");
      navigate("/workflows/designer", { replace: true });
    } catch {
      toast.show("Şablon yüklenemedi", "error");
    }
  };

  const forkTemplate = () => {
    setDraft({
      ...draft,
      id: undefined,
      name: `${draft.name} (kopya)`,
      readonly: false,
      builtin: false,
    });
    navigate("/workflows/designer");
    toast.show("Kopya oluşturuldu — kaydedince yeni şablon olur", "info");
  };

  const addParameter = () => {
    setDraft({
      ...draft,
      parameters: [
        ...draft.parameters,
        { name: `param${draft.parameters.length + 1}`, type: "string", required: false, default: "" },
      ],
    });
  };

  const updateParameter = (index: number, patch: Partial<WorkflowParam>) => {
    const parameters = [...draft.parameters];
    parameters[index] = { ...parameters[index], ...patch };
    setDraft({ ...draft, parameters });
  };

  const removeParameter = (index: number) => {
    setDraft({ ...draft, parameters: draft.parameters.filter((_, i) => i !== index) });
  };

  const heroActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link to="/runs">Runs</Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          navigate("/workflows/designer");
          setDraft(emptyDraft());
          setSelectedStep(0);
          setPreviewJson("");
        }}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Yeni
      </Button>
      {isReadonly && (
        <Button variant="outline" size="sm" onClick={forkTemplate}>
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Kopyala & düzenle
        </Button>
      )}
      <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isReadonly}>
        <Save className="mr-1.5 h-3.5 w-3.5" />
        Kaydet
      </Button>
      <Button variant="secondary" size="sm" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
        <Play className="mr-1.5 h-3.5 w-3.5" />
        Dry-run önizleme
      </Button>
      {draft.id && !draft.builtin && (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Sil
        </Button>
      )}
    </div>
  );

  return (
    <OpsPageShell className="max-w-[min(100%,88rem)]" stackClassName="gap-10 sm:gap-12">
      <OpsPageHero
        icon={Wand2}
        title="Workflow Designer"
        description="Çok adımlı agent akışları — tool sırası, checkpoint, onay ve parametreler."
        actions={heroActions}
      />

      <OpsStatGrid className="gap-4 sm:gap-5">
        <OpsStatCard label="Toplam adım" value={draft.steps.length} icon={Layers} delay={0} />
        <OpsStatCard label="Tool adımı" value={toolStepCount} icon={Bot} delay={0.05} />
        <OpsStatCard label="Parametre" value={draft.parameters.length} icon={Flag} delay={0.1} />
        <OpsStatCard
          label="Durum"
          value={draft.builtin ? "Builtin" : draft.id ? `v${draft.version ?? 1}` : "Taslak"}
          icon={Wand2}
          delay={0.15}
          tone={draft.builtin ? "warning" : draft.id ? "success" : "default"}
        />
      </OpsStatGrid>

      <div className="grid grid-cols-1 gap-y-10 gap-x-6 xl:grid-cols-12">
        {/* Template library */}
        <OpsPanel
          title="Şablon kütüphanesi"
          description="Builtin + kayıtlı workflow'lar"
          className="xl:col-span-3"
          icon={Layers}
        >
          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Şablon ara…"
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
            />
          </div>
          {templatesQuery.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <ScrollArea className="h-[min(420px,50vh)] pr-2">
              <ul className="space-y-1.5">
                {filteredTemplates.map((t) => {
                  const active = (draft.id && t.id === draft.id) || (!draft.id && t.id === id);
                  return (
                    <li key={t.id || t.name}>
                      <button
                        type="button"
                        onClick={() => loadTemplate(t)}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                          active
                            ? "border-primary/50 bg-primary/10"
                            : "border-border/50 bg-background/40 hover:bg-muted/30"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{t.name}</span>
                            {t.builtin && (
                              <Badge variant="outline" className="text-[10px]">
                                builtin
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {t.description || t.id}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {t.steps?.length ?? 0} adım · {t.parameters?.length ?? 0} param
                          </p>
                        </div>
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </OpsPanel>

        {/* Step timeline */}
        <OpsPanel title="Adım akışı" description="Sıra = çalıştırma sırası" className="xl:col-span-3" icon={Bot}>
          <ScrollArea className="h-[min(280px,36vh)] pr-2">
            <div className="space-y-1.5">
              {draft.steps.map((s, i) => {
                const Icon = stepIcon(s.type);
                return (
                  <div
                    key={i}
                    className={cn(
                      "group flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-colors",
                      i === selectedStep ? "border-primary/50 bg-primary/10" : "border-border/50"
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                      onClick={() => setSelectedStep(i)}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-xs font-semibold">
                        {i + 1}
                      </span>
                      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="min-w-0 truncate">
                        <span className="text-muted-foreground">{s.type}</span>
                        {s.toolName ? ` · ${s.toolName}` : s.name ? ` · ${s.name}` : ""}
                      </span>
                    </button>
                    {!isReadonly && (
                      <div className="flex shrink-0 gap-0.5 opacity-70 group-hover:opacity-100">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(i, -1)}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(i, 1)}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeStep(i)}
                          disabled={draft.steps.length <= 1}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          {!isReadonly && (
            <Button
              className="mt-3 w-full"
              variant="outline"
              onClick={() =>
                setDraft({
                  ...draft,
                  steps: [...draft.steps, { type: "tool", toolName: "", args: {} }],
                })
              }
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Adım ekle
            </Button>
          )}
        </OpsPanel>

        {/* Inspector */}
        <OpsPanel title="Düzenleyici" className="xl:col-span-4" icon={Wand2}>
          <Tabs defaultValue="step" className="w-full">
            <TabsList equalWidth className="mb-5">
              <TabsTrigger value="step">Adım</TabsTrigger>
              <TabsTrigger value="workflow">Workflow</TabsTrigger>
              <TabsTrigger value="params">Parametreler</TabsTrigger>
            </TabsList>

            <TabsContent value="workflow" className="mt-1 space-y-6">
              <div className="space-y-2">
                <Label>Workflow adı</Label>
                <Input
                  value={draft.name}
                  disabled={isReadonly}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Açıklama</Label>
                <Textarea
                  rows={4}
                  disabled={isReadonly}
                  value={draft.description || ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Bu workflow ne zaman çalıştırılmalı?"
                />
              </div>
              {draft.id && (
                <p className="text-xs text-muted-foreground">
                  ID: <code className="rounded bg-muted px-1">{draft.id}</code>
                  {isReadonly && " · Salt okunur (builtin) — düzenlemek için kopyala"}
                </p>
              )}
            </TabsContent>

            <TabsContent value="params" className="mt-1 space-y-5">
              {draft.parameters.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Run başlatırken doldurulacak alanlar. Örn. <code className="text-xs">repo</code>,{" "}
                  <code className="text-xs">branch</code>.
                </p>
              ) : (
                <div className="space-y-3">
                  {draft.parameters.map((p, i) => (
                    <div key={i} className="rounded-xl border border-border/50 p-3 space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs">Ad</Label>
                          <Input
                            disabled={isReadonly}
                            value={p.name}
                            onChange={(e) => updateParameter(i, { name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Varsayılan</Label>
                          <Input
                            disabled={isReadonly}
                            value={p.default || ""}
                            onChange={(e) => updateParameter(i, { default: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            disabled={isReadonly}
                            checked={!!p.required}
                            onChange={(e) => updateParameter(i, { required: e.target.checked })}
                          />
                          Zorunlu
                        </label>
                        {!isReadonly && (
                          <Button variant="ghost" size="sm" className="ml-auto h-7 text-destructive" onClick={() => removeParameter(i)}>
                            Kaldır
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!isReadonly && (
                <Button variant="outline" size="sm" onClick={addParameter}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Parametre ekle
                </Button>
              )}
            </TabsContent>

            <TabsContent value="step" className="mt-1 space-y-6">
              <div className="space-y-2">
                <Label>Step tipi</Label>
                <Select
                  disabled={isReadonly}
                  value={step?.type || "tool"}
                  onValueChange={(v) => updateStep({ type: v as WorkflowStep["type"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tool">tool — MCP aracı çağır</SelectItem>
                    <SelectItem value="checkpoint">checkpoint — duraklat / kaydet</SelectItem>
                    <SelectItem value="approval">approval — insan onayı</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(step?.type === "checkpoint" || step?.type === "approval") && (
                <div className="space-y-2">
                  <Label>Ad / mesaj</Label>
                  <Input
                    disabled={isReadonly}
                    value={step.name || ""}
                    onChange={(e) => updateStep({ name: e.target.value })}
                    placeholder={step.type === "approval" ? "Onay mesajı" : "checkpoint-adı"}
                  />
                </div>
              )}

              {step?.type === "tool" && (
                <>
                  <div className="space-y-2">
                    <Label>Tool seç</Label>
                    <SearchableSelect
                      value={step.toolName || ""}
                      onValueChange={(v) => updateStep({ toolName: v })}
                      options={toolOptions}
                      placeholder="Tool ara: repo_analyze, git_commit…"
                      disabled={isReadonly}
                      loading={toolsLoading}
                      emptyMessage="Eşleşen tool yok"
                    />
                    {step.toolName && (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {tools.find((t) => t.name === step.toolName)?.description || "—"}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Args (JSON) — <code className="text-xs">{`{{param}}`}</code> destekler</Label>
                    <Textarea
                      disabled={isReadonly}
                      rows={6}
                      className="font-mono text-xs"
                      value={JSON.stringify(step.args || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          updateStep({ args: JSON.parse(e.target.value) });
                        } catch {
                          /* typing */
                        }
                      }}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>When (opsiyonel)</Label>
                      <Input
                        disabled={isReadonly}
                        value={step.when || ""}
                        onChange={(e) => updateStep({ when: e.target.value || undefined })}
                        placeholder='skipIssues !== true'
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>maxRetries</Label>
                      <Input
                        disabled={isReadonly}
                        type="number"
                        min={0}
                        max={5}
                        value={step.maxRetries ?? ""}
                        onChange={(e) =>
                          updateStep({
                            maxRetries: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        placeholder="1"
                      />
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </OpsPanel>

        {/* Preview */}
        <OpsPanel title="Önizleme" description="Yerel özet + API dry-run planı" className="xl:col-span-2" icon={Play}>
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Adım özeti</p>
              <OpsCodeBlock>{summarizeSteps(draft.steps)}</OpsCodeBlock>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Dry-run plan (API)
              </p>
              {previewMutation.isPending ? (
                <Skeleton className="h-40 w-full" />
              ) : previewJson ? (
                <ScrollArea className="h-[min(320px,40vh)]">
                  <OpsCodeBlock>{previewJson}</OpsCodeBlock>
                </ScrollArea>
              ) : (
                <p className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
                  Kaydedip <strong>Dry-run önizleme</strong> ile genişletilmiş planı gör. Builtin şablonlarda doğrudan
                  önizleme çalışır.
                </p>
              )}
            </div>
          </div>
        </OpsPanel>
      </div>

      <OpsHelpPanel title="Workflow Designer rehberi">
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <strong>Şablon seç</strong> — Soldaki kütüphaneden builtin (CI fix, release vb.) veya kayıtlı workflow&apos;u
            aç. Builtin salt okunur; <em>Kopyala & düzenle</em> ile fork et.
          </li>
          <li>
            <strong>Adım ekle / sırala</strong> — Orta kolonda tool, checkpoint veya approval adımları ekle. Ok
            butonlarıyla sırayı değiştir.
          </li>
          <li>
            <strong>Tool bağla</strong> — Düzenleyici → Adım sekmesinde arama kutusuna yazarak tool bul (ör.{" "}
            <code className="text-xs">repo_analyze</code>). Args JSON&apos;da{" "}
            <code className="text-xs">{`{{repo}}`}</code> ile parametre kullan.
          </li>
          <li>
            <strong>Parametre tanımla</strong> — Parametreler sekmesinde run sırasında doldurulacak alanları ekle (
            <code className="text-xs">repo</code>, <code className="text-xs">branch</code>).
          </li>
          <li>
            <strong>Kaydet & önizle</strong> — Custom workflow için <em>Kaydet</em>, ardından <em>Dry-run önizleme</em>{" "}
            ile API planını sağ kolonda gör.
          </li>
          <li>
            <strong>Çalıştır</strong> — <Link to="/runs" className="text-primary underline-offset-2 hover:underline">Runs</Link>{" "}
            sayfasından şablonu seçip run başlat; veya Ops runbook ile zamanla.
          </li>
        </ol>
      </OpsHelpPanel>
    </OpsPageShell>
  );
}
