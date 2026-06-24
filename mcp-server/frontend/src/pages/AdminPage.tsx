import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  Cog,
  Layers,
  ListChecks,
  Package,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/layout/EmptyState";
import {
  OpsPageHero,
  OpsPageShell,
  OpsPanel,
  OpsPill,
  OpsStatCard,
  OpsStatGrid,
} from "@/components/ops/OpsPrimitives";
import { apiGet, apiGetRaw, apiPost, type PluginInfo } from "@/lib/api-client";
import { cn, formatTime } from "@/lib/utils";
import { useToast } from "@/providers/ToastProvider";

interface JobRow {
  id?: string;
  type?: string;
  state?: string;
  createdAt?: string;
}

interface ApprovalRow {
  id?: string;
  toolName?: string;
  path?: string;
}

function jobStateTone(state?: string) {
  const s = (state || "").toLowerCase();
  if (s.includes("done") || s.includes("complete")) return "bg-success/15 text-success";
  if (s.includes("fail") || s.includes("error")) return "bg-destructive/15 text-destructive";
  if (s.includes("run") || s.includes("active")) return "bg-primary/15 text-primary";
  return "bg-muted text-muted-foreground";
}

export function AdminPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<"approvals" | "jobs" | "plugins">("approvals");

  const { data: plugins = [] } = useQuery({
    queryKey: ["plugins"],
    queryFn: () => apiGet<PluginInfo[]>("/plugins"),
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => apiGetRaw<{ jobs?: JobRow[]; data?: { jobs?: JobRow[] } }>("/jobs?limit=20"),
  });

  const { data: jobStats, isLoading: statsLoading } = useQuery({
    queryKey: ["jobs-stats"],
    queryFn: () => apiGetRaw<{ stats?: Record<string, number>; data?: { stats?: Record<string, number> } }>("/jobs/stats"),
  });

  const { data: approvalsData, isLoading: approvalsLoading } = useQuery({
    queryKey: ["approvals-pending"],
    queryFn: () =>
      apiGetRaw<{ data?: { approvals?: ApprovalRow[] }; approvals?: ApprovalRow[] }>("/approvals/pending"),
  });

  const approveMutation = useMutation({
    mutationFn: (approvalId: string) => apiPost("/approve", { approval_id: approvalId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approvals-pending"] });
      toast.show("Onaylandı");
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Onay hatası", "error"),
  });

  const jobs = jobsData?.jobs ?? jobsData?.data?.jobs ?? [];
  const approvals = approvalsData?.data?.approvals ?? approvalsData?.approvals ?? [];
  const stats = jobStats?.stats ?? jobStats?.data?.stats ?? {};

  const statEntries = useMemo(() => Object.entries(stats).slice(0, 3), [stats]);
  const totalTools = useMemo(
    () => plugins.reduce((n, p) => n + (Array.isArray(p.tools) ? p.tools.length : 0), 0),
    [plugins]
  );

  return (
    <OpsPageShell>
      <OpsPageHero
        icon={ShieldCheck}
        title="Admin"
        description="Onay kuyruğu, arka plan işleri ve yüklü eklentilerin operasyonel özeti."
        actions={
          <div className="flex gap-1 rounded-full bg-muted/30 p-0.5">
            <OpsPill active={tab === "approvals"} onClick={() => setTab("approvals")}>
              Onaylar ({approvals.length})
            </OpsPill>
            <OpsPill active={tab === "jobs"} onClick={() => setTab("jobs")}>
              Jobs
            </OpsPill>
            <OpsPill active={tab === "plugins"} onClick={() => setTab("plugins")}>
              Plugins
            </OpsPill>
          </div>
        }
      />

      <OpsStatGrid>
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-2xl" />)
        ) : (
          <>
            <OpsStatCard
              label="Bekleyen onay"
              value={approvals.length}
              hint="Policy kuyruğu"
              icon={ListChecks}
              tone={approvals.length > 0 ? "warning" : "success"}
              delay={0.05}
            />
            {statEntries.map(([k, v], i) => (
              <OpsStatCard
                key={k}
                label={k.replace(/_/g, " ")}
                value={v}
                icon={Cog}
                delay={0.1 + i * 0.05}
              />
            ))}
            <OpsStatCard
              label="Eklentiler"
              value={plugins.length}
              hint={`${totalTools} toplam araç`}
              icon={Package}
              delay={0.2}
            />
          </>
        )}
      </OpsStatGrid>

      {tab === "approvals" && (
        <OpsPanel title="Onay Kuyruğu" description="Politika tarafından bekletilen araç çağrıları">
          {approvalsLoading ? (
            <Skeleton className="h-28 rounded-xl" />
          ) : approvals.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Bekleyen onay yok" description="Policy kuyruğu boş — her şey yolunda." />
          ) : (
            <ul className="space-y-3">
              {approvals.map((a, i) => (
                <motion.li
                  key={a.id || i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="truncate font-mono text-sm font-medium">{String(a.toolName || a.id || "—")}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{String(a.path || "")}</p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 rounded-xl"
                    disabled={!a.id || approveMutation.isPending}
                    onClick={() => a.id && approveMutation.mutate(a.id)}
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    Onayla
                  </Button>
                </motion.li>
              ))}
            </ul>
          )}
        </OpsPanel>
      )}

      {tab === "jobs" && (
        <OpsPanel title="Background Jobs" description="Son 20 iş ve durumları" noPadding>
          {jobsLoading ? (
            <div className="p-4">
              <Skeleton className="h-32 rounded-xl" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Aktif job yok</div>
          ) : (
            <div className="divide-y divide-border/40">
              {jobs.map((j, i) => (
                <motion.div
                  key={j.id || i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex flex-wrap items-center gap-3 px-4 py-3.5 text-sm hover:bg-muted/20 sm:flex-nowrap"
                >
                  <code className="w-full truncate font-mono text-xs text-muted-foreground sm:w-48">{j.id}</code>
                  <Badge className="font-mono text-[10px] border border-border/60 bg-muted/30">
                    {j.type}
                  </Badge>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", jobStateTone(j.state))}>
                    {j.state}
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {j.createdAt ? formatTime(j.createdAt) : "—"}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </OpsPanel>
      )}

      {tab === "plugins" && (
        <OpsPanel title="Yüklü Eklentiler" description={`${plugins.length} plugin · ${totalTools} araç`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plugins.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.25) }}
                className="group rounded-xl border border-border/50 bg-background/40 p-4 transition-colors hover:border-primary/30 hover:bg-muted/20"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{p.description || "—"}</p>
                    </div>
                  </div>
                  <Badge className="shrink-0 tabular-nums bg-muted/50">
                    {Array.isArray(p.tools) ? p.tools.length : 0}
                  </Badge>
                </div>
              </motion.div>
            ))}
          </div>
        </OpsPanel>
      )}
    </OpsPageShell>
  );
}
