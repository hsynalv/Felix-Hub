import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarClock, Cog, FileText, GitBranch, Play, Shield, Timer, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OpsPageHero, OpsPageShell, OpsPanel, OpsHelpPanel, OpsStatGrid, OpsStatCard } from "@/components/ops/OpsPrimitives";
import {
  analyzeRelease,
  createScheduleFromPreset,
  executeRunbook,
  fetchAgentPresets,
  fetchAutonomyMatrix,
  fetchRunbooks,
  fetchSchedules,
  preflightRunbook,
  scanHygiene,
  scanMaintenance,
  testFireSchedule,
  fetchBriefings,
  generateBriefing,
  fetchSlaViolations,
  fetchSlaDashboard,
  evaluateSla,
  fetchEnvRegistry,
  createPromotion,
  fetchPromotions,
  approvePromotion,
  executePromotion,
  triageIncident,
  diffEnvConfigs,
  briefingExportUrl,
  type Runbook,
  type PromotionRequest,
} from "@/lib/ops-api";
import { useToast } from "@/providers/ToastProvider";

function RunbookCard({ runbook, onPreflight, onExecute }: {
  runbook: Runbook;
  onPreflight: (id: string) => void;
  onExecute: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{runbook.name}</CardTitle>
          <div className="flex gap-1">
            {runbook.builtin && <Badge variant="outline">builtin</Badge>}
            <Badge variant="outline">{runbook.type}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{runbook.description || "—"}</p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>v{runbook.version}</span>
          <span>SLA {runbook.slaMinutes}m</span>
          <span>{runbook.autonomyLevel}</span>
          <span>{runbook.templateId}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onPreflight(runbook.id)}>
            Preflight
          </Button>
          <Button size="sm" onClick={() => onExecute(runbook.id)}>
            <Play className="mr-1 h-3 w-3" />
            Çalıştır
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function RunbooksPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedRunbook, setSelectedRunbook] = useState("rb-ci-fix");
  const [cronExpr, setCronExpr] = useState("0 9 * * 1");

  const runbooksQuery = useQuery({ queryKey: ["ops-runbooks"], queryFn: fetchRunbooks });
  const schedulesQuery = useQuery({ queryKey: ["ops-schedules"], queryFn: fetchSchedules });
  const autonomyQuery = useQuery({ queryKey: ["ops-autonomy"], queryFn: fetchAutonomyMatrix });
  const presetsQuery = useQuery({ queryKey: ["agent-presets"], queryFn: fetchAgentPresets });
  const briefingsQuery = useQuery({ queryKey: ["briefings"], queryFn: fetchBriefings });
  const slaQuery = useQuery({ queryKey: ["sla-violations"], queryFn: fetchSlaViolations });
  const slaDashboardQuery = useQuery({ queryKey: ["sla-dashboard"], queryFn: fetchSlaDashboard });
  const envQuery = useQuery({ queryKey: ["env-registry"], queryFn: fetchEnvRegistry });
  const promotionsQuery = useQuery({ queryKey: ["env-promotions"], queryFn: () => fetchPromotions() });

  const preflightMutation = useMutation({
    mutationFn: (id: string) => preflightRunbook(id, { repo: "acme/app", branch: "main", failureLog: "fail" }),
    onSuccess: (data) => {
      toast.show(
        data.allowed ? "Preflight geçti" : `Preflight engellendi: ${data.report?.summary || data.report?.outcome || "blocked"}`,
        data.allowed ? undefined : "error"
      );
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const executeMutation = useMutation({
    mutationFn: (id: string) => executeRunbook(id, { repo: "acme/app", branch: "main", failureLog: "fail" }, true),
    onSuccess: (data) => {
      toast.show(data.started ? `Dry-run başlatıldı: ${data.run?.id}` : `Çalıştırılamadı: ${data.outcome}`, data.started ? undefined : "error");
      queryClient.invalidateQueries({ queryKey: ["ops-runbooks"] });
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: () =>
      createScheduleFromForm(),
    onSuccess: () => {
      toast.show("Zamanlama oluşturuldu");
      queryClient.invalidateQueries({ queryKey: ["ops-schedules"] });
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const testFireMutation = useMutation({
    mutationFn: testFireSchedule,
    onSuccess: (data) => toast.show(`Test fire: ${data.outcome}`, data.fired ? undefined : "error"),
  });

  const releaseAnalyzeMutation = useMutation({
    mutationFn: () => analyzeRelease("acme/app", "v1.0.0"),
    onSuccess: (data) => toast.show(`Release analizi: ${data.semver.suggested} (${data.prCount} PR)`),
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const maintenanceScanMutation = useMutation({
    mutationFn: () => scanMaintenance("."),
    onSuccess: (data) => toast.show(`Maintenance: ${data.outdatedCount} paket, ${data.highRisk.length} yüksek risk`),
  });

  const hygieneScanMutation = useMutation({
    mutationFn: () => scanHygiene("acme/app"),
    onSuccess: (data) => toast.show(`Hygiene: ${data.summary.stalePrCount} stale PR, ${data.summary.todoCount} TODO`),
  });

  const presetScheduleMutation = useMutation({
    mutationFn: (presetId: string) => createScheduleFromPreset(presetId),
    onSuccess: () => {
      toast.show("Preset zamanlama oluşturuldu");
      queryClient.invalidateQueries({ queryKey: ["ops-schedules"] });
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const briefingMutation = useMutation({
    mutationFn: () => generateBriefing("daily_engineering"),
    onSuccess: () => {
      toast.show("Briefing üretildi");
      queryClient.invalidateQueries({ queryKey: ["briefings"] });
    },
  });

  const incidentMutation = useMutation({
    mutationFn: () => triageIncident("acme/app"),
    onSuccess: (data) => toast.show(`Incident triage: ${data.suspectedCauses.length} olası neden`),
  });

  const promotionMutation = useMutation({
    mutationFn: () => createPromotion("staging", "production", "Release v2.0"),
    onSuccess: (data) => {
      toast.show(`Promotion talebi: ${data.status}`);
      queryClient.invalidateQueries({ queryKey: ["env-promotions"] });
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const slaEvaluateMutation = useMutation({
    mutationFn: evaluateSla,
    onSuccess: () => {
      toast.show("SLA değerlendirmesi tamamlandı");
      queryClient.invalidateQueries({ queryKey: ["sla-violations"] });
      queryClient.invalidateQueries({ queryKey: ["sla-dashboard"] });
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const executePromotionMutation = useMutation({
    mutationFn: (id: string) => executePromotion(id),
    onSuccess: () => {
      toast.show("Promotion uygulandı (config merge)");
      queryClient.invalidateQueries({ queryKey: ["env-promotions"] });
      queryClient.invalidateQueries({ queryKey: ["env-registry"] });
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  async function approvePromotionStep(promo: PromotionRequest) {
    const pending = promo.approvals.find((a) => a.status === "pending");
    if (!pending) return;
    try {
      await approvePromotion(promo.id, pending.role, "approve");
      toast.show(`${pending.role} onaylandı`);
      queryClient.invalidateQueries({ queryKey: ["env-promotions"] });
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Onay hatası", "error");
    }
  }

  const envDiffMutation = useMutation({
    mutationFn: () => diffEnvConfigs("staging", "production"),
    onSuccess: (data) => toast.show(`Config diff: ${data.diffs.length} fark (masked)`),
  });

  async function createScheduleFromForm() {
    const { createSchedule } = await import("@/lib/ops-api");
    return createSchedule({
      name: "Haftalık dependency scan",
      runbookId: selectedRunbook,
      cronExpr,
      timezone: "UTC",
      maxCostUsd: 5,
      autonomyLevel: "L4",
      skipIf: { type: "cost_anomaly" },
    });
  }

  const runbooks = runbooksQuery.data?.runbooks ?? [];
  const schedules = schedulesQuery.data?.schedules ?? [];
  const autonomy = autonomyQuery.data;

  return (
    <OpsPageShell>
      <OpsPageHero
        icon={BookOpen}
        title="Runbooks & Schedules"
        description="V5 operasyon platformu — runbook'lar, agent'lar, briefing'ler, SLA ve ortam promotion."
      />

      <Tabs defaultValue="runbooks" className="mt-6">
        <TabsList equalWidth>
          <TabsTrigger value="runbooks">Runbooks</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="autonomy">Autonomy</TabsTrigger>
          <TabsTrigger value="briefings">Briefings</TabsTrigger>
          <TabsTrigger value="sla">SLA</TabsTrigger>
          <TabsTrigger value="env">Promotion</TabsTrigger>
          <TabsTrigger value="help">Rehber</TabsTrigger>
        </TabsList>

        <TabsContent value="runbooks" className="mt-4">
          <OpsPanel title="Runbook kataloğu" icon={BookOpen}>
            {runbooksQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : runbooksQuery.isError ? (
              <p className="text-sm text-destructive">
                Runbook listesi yüklenemedi: {(runbooksQuery.error as Error).message}. API (8787) ve giriş (read scope) kontrol et.
              </p>
            ) : runbooks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Builtin runbook bulunamadı. Sunucu yeniden başlatıldığında `rb-ci-fix`, `rb-maintenance` vb. gelmeli.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {runbooks.map((rb) => (
                  <RunbookCard
                    key={rb.id}
                    runbook={rb}
                    onPreflight={(id) => preflightMutation.mutate(id)}
                    onExecute={(id) => executeMutation.mutate(id)}
                  />
                ))}
              </div>
            )}
          </OpsPanel>
        </TabsContent>

        <TabsContent value="agents" className="mt-4 space-y-4">
          <OpsPanel title="Engineering Agents (V5 Faz B)" icon={Cog}>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Release Manager</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">Changelog, semver, migration risk, draft release</p>
                  <Button size="sm" variant="outline" onClick={() => releaseAnalyzeMutation.mutate()}>
                    Analiz et
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Maintenance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">Dependency + vuln scan, risk skorlu PR</p>
                  <Button size="sm" variant="outline" onClick={() => maintenanceScanMutation.mutate()}>
                    Scan
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Workspace Hygiene</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">Stale PR, TODO, failed run raporu</p>
                  <Button size="sm" variant="outline" onClick={() => hygieneScanMutation.mutate()}>
                    Scan
                  </Button>
                </CardContent>
              </Card>
            </div>
          </OpsPanel>

          <OpsPanel title="Schedule presets" icon={CalendarClock}>
            {presetsQuery.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-2">
                {(presetsQuery.data?.schedules ?? [])
                  .filter((p) => !("manual" in p && p.manual))
                  .map((preset) => (
                    <div key={preset.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <div>
                        <div className="font-medium">{preset.name}</div>
                        <div className="text-muted-foreground">{preset.description}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => presetScheduleMutation.mutate(preset.id)}
                        disabled={presetScheduleMutation.isPending}
                      >
                        Zamanla
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </OpsPanel>
        </TabsContent>

        <TabsContent value="schedules" className="mt-4 space-y-4">
          <OpsPanel title="Yeni zamanlama" icon={CalendarClock}>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Runbook</Label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={selectedRunbook}
                  onChange={(e) => setSelectedRunbook(e.target.value)}
                >
                  {runbooks.map((rb) => (
                    <option key={rb.id} value={rb.id}>
                      {rb.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Cron (UTC)</Label>
                <Input className="mt-1" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button onClick={() => scheduleMutation.mutate()} disabled={scheduleMutation.isPending}>
                  Oluştur
                </Button>
              </div>
            </div>
          </OpsPanel>

          <OpsPanel title="Aktif zamanlamalar" icon={Zap}>
            {schedulesQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz zamanlama yok.</p>
            ) : (
              <div className="space-y-2">
                {schedules.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-muted-foreground">
                        {s.cronExpr} · {s.autonomyLevel} · max ${s.maxCostUsd}
                        {s.paused && " · paused"}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => testFireMutation.mutate(s.id)}>
                      Test fire
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </OpsPanel>
        </TabsContent>

        <TabsContent value="autonomy" className="mt-4">
          <OpsPanel title="Autonomy matrix" icon={Shield}>
            {autonomyQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : autonomy ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  L0 observe → L5 production autonomous. Varsayılan seviyeler ortam bazlı uygulanır.
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {Object.entries(autonomy.envs).map(([env, level]) => (
                    <div key={env} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span className="capitalize">{env}</span>
                      <Badge>{level}</Badge>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {autonomy.levels.map((l) => (
                    <div key={l}>
                      <strong>{l}</strong> — {autonomy.descriptions[l]}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </OpsPanel>
        </TabsContent>

        <TabsContent value="briefings" className="mt-4 space-y-4">
          <OpsPanel title="Engineering Briefings" icon={FileText}>
            <div className="mb-4 flex gap-2">
              <Button size="sm" onClick={() => briefingMutation.mutate()} disabled={briefingMutation.isPending}>
                Daily brief üret
              </Button>
              <Button size="sm" variant="outline" onClick={() => presetScheduleMutation.mutate("preset-daily-brief")}>
                Sabah schedule ekle
              </Button>
            </div>
            {briefingsQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="space-y-2">
                {(briefingsQuery.data?.briefings ?? []).slice(0, 5).map((b) => (
                  <div key={b.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{b.title}</div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" asChild>
                          <a href={briefingExportUrl(b.id, "md")} download>
                            MD
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={briefingExportUrl(b.id, "html")} target="_blank" rel="noreferrer">
                            HTML
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={briefingExportUrl(b.id, "pdf")} download>
                            PDF
                          </a>
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{b.createdAt}</div>
                    <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs">{b.markdown.slice(0, 400)}</pre>
                  </div>
                ))}
              </div>
            )}
          </OpsPanel>
        </TabsContent>

        <TabsContent value="sla" className="mt-4 space-y-4">
          <OpsPanel title="SLA Dashboard" icon={Shield}>
            <div className="mb-4 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => slaEvaluateMutation.mutate()} disabled={slaEvaluateMutation.isPending}>
                SLA değerlendir
              </Button>
            </div>
            {slaDashboardQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : slaDashboardQuery.data ? (
              <>
                <OpsStatGrid>
                  <OpsStatCard icon={Shield} label="Toplam ihlal" value={String(slaDashboardQuery.data.totalViolations)} />
                  <OpsStatCard icon={CalendarClock} label="Son 7 gün" value={String(slaDashboardQuery.data.violationsLast7d)} />
                  <OpsStatCard
                    icon={Timer}
                    label="MTTR (tahmini)"
                    value={
                      slaDashboardQuery.data.mttrMinutesEstimate != null
                        ? `${slaDashboardQuery.data.mttrMinutesEstimate} dk`
                        : "—"
                    }
                  />
                </OpsStatGrid>
                {Object.keys(slaDashboardQuery.data.byRule || {}).length > 0 ? (
                  <div className="mt-4 space-y-1 text-sm">
                    <div className="font-medium">Kural dağılımı</div>
                    {Object.entries(slaDashboardQuery.data.byRule).map(([rule, count]) => (
                      <div key={rule} className="flex justify-between rounded border px-2 py-1 text-xs">
                        <span>{rule}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </OpsPanel>
          <OpsPanel title="SLA Violations" icon={Shield}>
            {slaQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (slaQuery.data?.violations ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz SLA ihlali yok.</p>
            ) : (
              <div className="space-y-2">
                {slaQuery.data?.violations.map((v) => (
                  <div key={v.id} className="rounded-lg border p-3 text-sm">
                    <Badge variant="outline">{v.rule}</Badge>
                    <p className="mt-1">{v.message}</p>
                    {v.at ? <p className="text-xs text-muted-foreground">{v.at}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </OpsPanel>
        </TabsContent>

        <TabsContent value="env" className="mt-4 space-y-4">
          <OpsPanel title="Environment Registry" icon={GitBranch}>
            {envQuery.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="grid gap-2 md:grid-cols-3">
                {Object.entries(envQuery.data?.environments ?? {}).map(([env, cfg]) => (
                  <div key={env} className="rounded-lg border px-3 py-2 text-sm">
                    <span className="capitalize">{env}</span>
                    <Badge className="ml-2">{cfg.autonomyLevel}</Badge>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => envDiffMutation.mutate()}>
                Config diff (masked)
              </Button>
              <Button size="sm" onClick={() => promotionMutation.mutate()}>
                Staging → Prod talebi
              </Button>
            </div>
          </OpsPanel>
          <OpsPanel title="Promotion requests" icon={GitBranch}>
            {promotionsQuery.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (promotionsQuery.data?.requests ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz promotion talebi yok.</p>
            ) : (
              <div className="space-y-2">
                {(promotionsQuery.data?.requests ?? []).slice(0, 5).map((p) => (
                  <div key={p.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {p.fromEnv} → {p.toEnv}
                      </span>
                      <Badge variant="outline">{p.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.changeSummary || p.id}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.approvals?.map((a) => (
                        <Badge key={a.role} variant={a.status === "approved" ? "default" : "outline"}>
                          {a.role}: {a.status}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      {p.status === "pending_approval" ? (
                        <Button size="sm" variant="outline" onClick={() => void approvePromotionStep(p)}>
                          Sıradaki onay
                        </Button>
                      ) : null}
                      {p.status === "approved" ? (
                        <Button size="sm" onClick={() => executePromotionMutation.mutate(p.id)}>
                          Execute promotion
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </OpsPanel>
          <OpsPanel title="Incident Triage" icon={Cog}>
            <Button size="sm" variant="outline" onClick={() => incidentMutation.mutate()}>
              Simüle error spike triage
            </Button>
          </OpsPanel>
        </TabsContent>

        <TabsContent value="help" className="mt-4">
          <OpsHelpPanel>
            <p>
              <strong>Ops</strong> sayfası agent işletim katmanıdır — kod yazdıran araç değil, runbook ve zamanlanmış operasyonları yönetir.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Runbooks:</strong> Hazır iş akışları (CI fix, maintenance, hygiene). Preflight kontrol eder; Çalıştır dry-run başlatır.
              </li>
              <li>
                <strong>Agents:</strong> Release / maintenance / hygiene taramaları — analiz butonları API çağırır, sonucu toast’ta görürsün.
              </li>
              <li>
                <strong>Schedules:</strong> Cron ile otomatik tetikleme. &quot;Yeni zamanlama&quot; formundan runbook + cron gir; preset’ler Agents sekmesinde.
              </li>
              <li>
                <strong>Autonomy:</strong> L0–L5 politika matrisi (salt okunur). Değiştirmek için API: <code className="text-xs">PUT /ops/autonomy</code>.
              </li>
              <li>
                <strong>Briefings:</strong> &quot;Daily brief üret&quot; ile rapor oluşturulur — liste boşsa önce üret.
              </li>
              <li>
                <strong>SLA / Promotion:</strong> İhlaller ve staging→prod talepleri; veri yoksa &quot;henüz yok&quot; normaldir.
              </li>
            </ul>
            <p className="text-xs">
              Yeni runbook eklemek UI’da yok (MVP); <code className="text-xs">POST /ops/runbooks</code> veya kodda builtin tanımı gerekir.
              Giriş yapmadıysan veya API 5173’teyse proxy/auth yüzünden liste boş kalabilir.
            </p>
          </OpsHelpPanel>
        </TabsContent>
      </Tabs>
    </OpsPageShell>
  );
}
