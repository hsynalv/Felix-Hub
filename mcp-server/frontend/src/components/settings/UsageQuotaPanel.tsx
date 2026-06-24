import { Gauge } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingsInfoBox, SettingsSectionCard } from "@/components/settings/shared";
import { getProjectId } from "@/lib/project-context";
import {
  checkProjectQuota,
  fetchUsageQuotas,
  upsertUsageQuota,
} from "@/lib/usage-api";
import { useToast } from "@/providers/ToastProvider";

export function UsageQuotaPanel() {
  const projectId = getProjectId();
  const toast = useToast();
  const qc = useQueryClient();

  const [limitUsd, setLimitUsd] = useState("");
  const [hardStop, setHardStop] = useState(false);

  const quotasQuery = useQuery({
    queryKey: ["usage-quotas"],
    queryFn: fetchUsageQuotas,
  });

  const checkQuery = useQuery({
    queryKey: ["quota-check", projectId],
    queryFn: () => checkProjectQuota(projectId),
    refetchInterval: 60_000,
  });

  const projectQuota = quotasQuery.data?.quotas?.find(
    (q) => q.scopeType === "project" && (q.scopeId === projectId || q.scopeId === "*")
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertUsageQuota({
        scopeType: "project",
        scopeId: projectId,
        period: "monthly",
        limitUsd: limitUsd ? parseFloat(limitUsd) : null,
        hardStop,
        alertThreshold: 0.8,
      }),
    onSuccess: () => {
      toast.show("Kota kaydedildi");
      qc.invalidateQueries({ queryKey: ["usage-quotas"] });
      qc.invalidateQueries({ queryKey: ["quota-check"] });
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  return (
    <SettingsSectionCard
      icon={Gauge}
      title="Kullanım kotası"
      description="Proje bazlı aylık maliyet limiti. Limite yaklaşıldığında uyarı, hard-stop açıksa LLM çağrıları engellenir."
    >
      <div className="space-y-5">
        {checkQuery.data?.warning && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            Kota uyarısı: aylık kullanım limite yaklaşıyor veya aşıldı.
          </div>
        )}

        {projectQuota && (
          <p className="text-sm text-muted-foreground">
            Mevcut kota: ${projectQuota.limitUsd ?? "—"} / ay
            {projectQuota.hardStop ? " (hard stop)" : ""}
          </p>
        )}

        {checkQuery.data?.usage && (
          <p className="text-sm">
            Bu ay kullanım: ~${(checkQuery.data.usage.estimatedCostUsd ?? 0).toFixed(4)} ·{" "}
            {(checkQuery.data.usage.totalTokens ?? 0).toLocaleString()} token
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Aylık USD limiti</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={limitUsd}
              onChange={(e) => setLimitUsd(e.target.value)}
              placeholder={projectQuota?.limitUsd?.toString() || "10.00"}
            />
          </div>
          <div className="flex items-end gap-3 pb-1">
            <Switch id="hard-stop" checked={hardStop} onCheckedChange={setHardStop} />
            <Label htmlFor="hard-stop">Hard stop (limitte LLM engelle)</Label>
          </div>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          Kotayı kaydet
        </Button>

        <SettingsInfoBox>
          Kota proje anahtarı <code className="text-xs">{projectId}</code> için geçerlidir. Ayarlar → Proje
          bölümünden proje seçin.
        </SettingsInfoBox>
      </div>
    </SettingsSectionCard>
  );
}
