import type { IntentTrainConfig } from "@/lib/intent-training-api";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function IntentTrainingSettingsPanel({
  config,
  onChange,
}: {
  config: IntentTrainConfig;
  onChange: (patch: Partial<IntentTrainConfig>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 rounded-xl border border-border/60 p-4">
        <h3 className="text-sm font-semibold">Eğitim LLM (chat&apos;ten ayrı)</h3>
        <Label className="text-xs">Provider</Label>
        <Input
          value={config.trainLlm.provider}
          onChange={(e) =>
            onChange({ trainLlm: { ...config.trainLlm, provider: e.target.value } })
          }
        />
        <Label className="text-xs">Model</Label>
        <Input
          value={config.trainLlm.model}
          onChange={(e) => onChange({ trainLlm: { ...config.trainLlm, model: e.target.value } })}
        />
      </div>
      <div className="space-y-3 rounded-xl border border-border/60 p-4">
        <div className="flex items-center justify-between">
          <Label>Örnek toplama</Label>
          <Switch
            checked={config.collectEnabled}
            onCheckedChange={(v) => onChange({ collectEnabled: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Private mode (örnek kaydetme)</Label>
          <Switch
            checked={config.privateMode}
            onCheckedChange={(v) => onChange({ privateMode: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">PII redaction</Label>
          <Switch
            checked={config.redactSamples}
            onCheckedChange={(v) => onChange({ redactSamples: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label>Runtime LLM fallback</Label>
          <Switch
            checked={config.runtimeLlmFallback}
            onCheckedChange={(v) => onChange({ runtimeLlmFallback: v })}
          />
        </div>
        <div>
          <Label className="text-xs">NLP eşik ({config.nlpConfidenceThreshold})</Label>
          <input
            type="range"
            min={0.5}
            max={0.95}
            step={0.05}
            value={config.nlpConfidenceThreshold}
            onChange={(e) => onChange({ nlpConfidenceThreshold: Number(e.target.value) })}
            className="w-full"
          />
        </div>
        <div>
          <Label className="text-xs">Zamanlama (saat)</Label>
          <Input
            type="number"
            value={config.scheduleHours}
            onChange={(e) => onChange({ scheduleHours: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label className="text-xs">Min örnek (train)</Label>
          <Input
            type="number"
            value={config.minPendingForTrain}
            onChange={(e) => onChange({ minPendingForTrain: Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}
