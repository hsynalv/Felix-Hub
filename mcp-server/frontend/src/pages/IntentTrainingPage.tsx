import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrainCircuit, Loader2, RefreshCw, Tags, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  OpsPageHero,
  OpsPageShell,
  OpsPanel,
  OpsStatCard,
  OpsStatGrid,
} from "@/components/ops/OpsPrimitives";
import {
  fetchIntentTrainingStatus,
  updateIntentTrainingConfig,
  fetchIntentMetrics,
  fetchIntentPipeline,
  fetchIntentModels,
  fetchIntentSamples,
  fetchIntentCorpus,
  triggerLabelJob,
  triggerTrainJob,
  reloadIntentModel,
  type IntentTrainConfig,
} from "@/lib/intent-training-api";
import { IntentPipelineStepper } from "@/components/intent-training/IntentPipelineStepper";
import { IntentDistributionChart } from "@/components/intent-training/IntentDistributionChart";
import { IntentPlayground } from "@/components/intent-training/IntentPlayground";
import { IntentDisagreementQueue } from "@/components/intent-training/IntentDisagreementQueue";
import { IntentReviewQueue } from "@/components/intent-training/IntentReviewQueue";
import { IntentCorpusExplorer } from "@/components/intent-training/IntentCorpusExplorer";
import { IntentTrainingSettingsPanel } from "@/components/intent-training/IntentTrainingSettingsPanel";
import { IntentEvalReport } from "@/components/intent-training/IntentEvalReport";
import { ModelVersionTimeline } from "@/components/intent-training/ModelVersionTimeline";
import { IntentJobMonitor } from "@/components/intent-training/IntentJobMonitor";
import { useToast } from "@/providers/ToastProvider";

export function IntentTrainingPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [localConfig, setLocalConfig] = useState<IntentTrainConfig | null>(null);

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ["intent-status"] });
    void qc.invalidateQueries({ queryKey: ["intent-metrics"] });
    void qc.invalidateQueries({ queryKey: ["intent-pipeline"] });
    void qc.invalidateQueries({ queryKey: ["intent-models"] });
    void qc.invalidateQueries({ queryKey: ["intent-samples"] });
    void qc.invalidateQueries({ queryKey: ["intent-corpus"] });
  };

  const { data: status, isLoading } = useQuery({
    queryKey: ["intent-status"],
    queryFn: fetchIntentTrainingStatus,
    refetchInterval: autoRefresh ? 15_000 : false,
  });

  const { data: metrics } = useQuery({
    queryKey: ["intent-metrics"],
    queryFn: fetchIntentMetrics,
    refetchInterval: autoRefresh ? 15_000 : false,
  });

  const { data: pipeline } = useQuery({
    queryKey: ["intent-pipeline"],
    queryFn: fetchIntentPipeline,
    refetchInterval: autoRefresh ? 15_000 : false,
  });

  const { data: models } = useQuery({
    queryKey: ["intent-models"],
    queryFn: fetchIntentModels,
  });

  const { data: disagreements } = useQuery({
    queryKey: ["intent-samples", "disagreement"],
    queryFn: () => fetchIntentSamples("disagreement"),
  });

  const { data: pending } = useQuery({
    queryKey: ["intent-samples", "pending"],
    queryFn: () => fetchIntentSamples("pending"),
  });

  const { data: corpus } = useQuery({
    queryKey: ["intent-corpus"],
    queryFn: () => fetchIntentCorpus(),
  });

  const config = localConfig ?? status?.config;

  const saveConfig = useMutation({
    mutationFn: (patch: Partial<IntentTrainConfig>) =>
      updateIntentTrainingConfig({ ...config!, ...patch }),
    onSuccess: (data) => {
      setLocalConfig(data);
      refreshAll();
      toast.show("Ayarlar kaydedildi");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const patchConfig = (patch: Partial<IntentTrainConfig>) => {
    setLocalConfig({ ...config!, ...patch });
    saveConfig.mutate(patch);
  };

  const labelJob = useMutation({
    mutationFn: triggerLabelJob,
    onSuccess: (j) => {
      setActiveJobId(j.id);
      toast.show("Etiketleme job başlatıldı");
    },
  });

  const trainJob = useMutation({
    mutationFn: triggerTrainJob,
    onSuccess: (j) => {
      setActiveJobId(j.id);
      toast.show("Eğitim job başlatıldı");
    },
  });

  const reload = useMutation({
    mutationFn: reloadIntentModel,
    onSuccess: () => {
      refreshAll();
      toast.show("Model yeniden yüklendi");
    },
  });

  if (isLoading || !status || !config) {
    return (
      <OpsPageShell>
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </OpsPageShell>
    );
  }

  const intents = status.intents;
  const disagreementCount = status.counts.disagreement;

  return (
    <OpsPageShell>
      <OpsPageHero
        icon={BrainCircuit}
        title="Intent Eğitimi"
        description="Chat intent sınıflandırıcısı — örnek toplama, NLP eğitimi ve çelişki çözümü."
        actions={
          <>
            <div className="flex items-center gap-2 text-sm">
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="auto-refresh" />
              <Label htmlFor="auto-refresh">Otomatik yenile</Label>
            </div>
            <Button size="sm" variant="outline" onClick={refreshAll}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={labelJob.isPending} onClick={() => labelJob.mutate()}>
              <Tags className="mr-1 h-4 w-4" /> Etiketle
            </Button>
            <Button size="sm" disabled={trainJob.isPending} onClick={() => trainJob.mutate()}>
              <GitMerge className="mr-1 h-4 w-4" /> Eğit
            </Button>
          </>
        }
      />

      <OpsPanel title="Pipeline kontrolü" noPadding className="p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SwitchRow
            label="Eğitim pipeline"
            checked={config.pipelineEnabled}
            onCheckedChange={(v) => patchConfig({ pipelineEnabled: v })}
          />
          <SwitchRow
            label="Örnek toplama"
            checked={config.collectEnabled}
            onCheckedChange={(v) => patchConfig({ collectEnabled: v })}
          />
          <SwitchRow
            label="NLP runtime"
            checked={config.nlpRuntimeEnabled}
            onCheckedChange={(v) => patchConfig({ nlpRuntimeEnabled: v })}
          />
          <SwitchRow
            label="LLM etiketleme"
            checked={config.llmLabelingEnabled}
            onCheckedChange={(v) => patchConfig({ llmLabelingEnabled: v })}
          />
        </div>
      </OpsPanel>

      <OpsStatGrid>
        <OpsStatCard
          label="Aktif model"
          value={status.activeVersion != null ? `v${status.activeVersion}` : "—"}
          icon={BrainCircuit}
          tone={status.activeVersion ? "success" : "warning"}
        />
        <OpsStatCard
          label="Golden doğruluk"
          value={
            status.lastModel?.evalAccuracy != null
              ? `${(status.lastModel.evalAccuracy * 100).toFixed(0)}%`
              : "—"
          }
          icon={GitMerge}
        />
        <OpsStatCard label="Corpus" value={status.corpusSize} icon={Tags} />
        <OpsStatCard
          label="Çelişki"
          value={disagreementCount}
          icon={BrainCircuit}
          tone={disagreementCount > 0 ? "warning" : "default"}
        />
        <OpsStatCard label="Bekleyen" value={status.counts.pending} icon={Tags} />
        <OpsStatCard label="Bugün toplanan" value={status.samplesToday} icon={RefreshCw} />
      </OpsStatGrid>

      <OpsPanel title="Pipeline" description="Topla → Etiketle → Eğit → Yayınla">
        <IntentPipelineStepper
          steps={pipeline?.steps ?? []}
          pipelineEnabled={config.pipelineEnabled}
        />
      </OpsPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <OpsPanel title="Intent dağılımı">
          <IntentDistributionChart
            corpusByIntent={metrics?.corpusByIntent ?? {}}
            predictionsLast7d={metrics?.predictionsLast7d ?? {}}
            intents={intents}
          />
        </OpsPanel>
        <OpsPanel
          title="Model geçmişi"
          actions={
            <Button size="sm" variant="ghost" disabled={reload.isPending} onClick={() => reload.mutate()}>
              Yeniden yükle
            </Button>
          }
        >
          <ModelVersionTimeline
            models={models ?? []}
            activeVersion={status.activeVersion}
            onRollback={refreshAll}
          />
        </OpsPanel>
      </div>

      <OpsPanel title="Playground">
        <IntentPlayground onCorpusAdded={refreshAll} />
      </OpsPanel>

      <Tabs defaultValue="disagreements">
        <TabsList equalWidth>
          <TabsTrigger value="disagreements">
            Çelişkiler
            {disagreementCount > 0 && (
              <Badge className="ml-2" variant="default">
                {disagreementCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="review">İnceleme</TabsTrigger>
          <TabsTrigger value="corpus">Corpus</TabsTrigger>
          <TabsTrigger value="settings">Ayarlar</TabsTrigger>
          <TabsTrigger value="report">Eğitim raporu</TabsTrigger>
        </TabsList>
        <TabsContent value="disagreements" className="mt-4">
          <IntentDisagreementQueue
            samples={disagreements ?? []}
            intents={intents}
            onResolved={refreshAll}
          />
        </TabsContent>
        <TabsContent value="review" className="mt-4">
          <IntentReviewQueue samples={pending ?? []} onUpdated={refreshAll} />
        </TabsContent>
        <TabsContent value="corpus" className="mt-4">
          <IntentCorpusExplorer entries={corpus ?? []} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <IntentTrainingSettingsPanel config={config} onChange={patchConfig} />
        </TabsContent>
        <TabsContent value="report" className="mt-4">
          <IntentEvalReport evalReport={models?.[0]?.evalReport as Record<string, unknown>} />
        </TabsContent>
      </Tabs>

      <IntentJobMonitor jobId={activeJobId} />
    </OpsPageShell>
  );
}

function SwitchRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
