import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Archive,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileSearch,
  Search,
  Server,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  OpsCodeBlock,
  OpsMethodBadge,
  OpsPageHero,
  OpsPageShell,
  OpsPanel,
  OpsPill,
  OpsStatCard,
  OpsStatGrid,
  OpsToolbar,
} from "@/components/ops/OpsPrimitives";
import { apiGetRaw, type AuditEntry } from "@/lib/api-client";
import { cn, formatDuration, formatTime } from "@/lib/utils";

interface RequestLog {
  timestamp?: string;
  method?: string;
  path?: string;
  status?: string | number;
}

function statusTone(status?: string | number) {
  const n = Number(status);
  if (n >= 500) return "text-destructive";
  if (n >= 400) return "text-amber-500";
  if (n >= 200 && n < 300) return "text-success";
  return "text-muted-foreground";
}

function AuditRow({ entry, index }: { entry: AuditEntry; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.2) }}
      className="rounded-xl border border-border/50 bg-background/40"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/30 sm:px-4"
      >
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        <span className="hidden w-28 shrink-0 text-xs text-muted-foreground sm:block">{formatTime(entry.timestamp)}</span>
        <Badge className="shrink-0 font-mono text-[10px] border border-border/60 bg-muted/30">
          {entry.plugin}
        </Badge>
        <span className="min-w-0 flex-1 truncate font-medium">{entry.operation}</span>
        {entry.success ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
        ) : (
          <XCircle className="h-4 w-4 shrink-0 text-destructive" />
        )}
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatDuration(entry.durationMs)}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/40"
          >
            <div className="space-y-2 p-3 sm:p-4">
              <p className="text-xs text-muted-foreground sm:hidden">{formatTime(entry.timestamp)}</p>
              <OpsCodeBlock>{JSON.stringify(entry.metadata ?? entry, null, 2)}</OpsCodeBlock>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function AuditPage() {
  const [plugin, setPlugin] = useState("");
  const [limit, setLimit] = useState("100");
  const [tab, setTab] = useState<"archive" | "requests">("archive");
  const [search, setSearch] = useState("");

  const { data: archiveData, isLoading: archiveLoading } = useQuery({
    queryKey: ["audit-archive", plugin, limit],
    queryFn: () => {
      let path = `/audit/archive?limit=${limit}`;
      if (plugin) path += `&plugin=${encodeURIComponent(plugin)}`;
      return apiGetRaw<{ source?: string; entries?: AuditEntry[]; data?: { entries?: AuditEntry[] } }>(path);
    },
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["audit-logs", limit],
    queryFn: () =>
      apiGetRaw<{ logs?: RequestLog[]; data?: { logs?: RequestLog[] } }>(`/audit/logs?limit=${limit}`),
  });

  const entries = archiveData?.entries ?? archiveData?.data?.entries ?? [];
  const logs = logsData?.logs ?? logsData?.data?.logs ?? [];

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.plugin?.toLowerCase().includes(q) ||
        e.operation?.toLowerCase().includes(q) ||
        JSON.stringify(e.metadata ?? "").toLowerCase().includes(q)
    );
  }, [entries, search]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.path?.toLowerCase().includes(q) ||
        l.method?.toLowerCase().includes(q) ||
        String(l.status).includes(q)
    );
  }, [logs, search]);

  const stats = useMemo(() => {
    const ok = entries.filter((e) => e.success).length;
    const fail = entries.length - ok;
    const rate = entries.length ? Math.round((ok / entries.length) * 100) : 0;
    const errLogs = logs.filter((l) => Number(l.status) >= 400).length;
    return { ok, fail, rate, errLogs };
  }, [entries, logs]);

  return (
    <OpsPageShell>
      <OpsPageHero
        icon={FileSearch}
        title="Audit"
        description="Tool çağrı arşivi ve HTTP request logları. Güvenlik ve operasyon incelemesi için tek ekran."
      />

      <OpsStatGrid>
        <OpsStatCard label="Kayıt" value={entries.length} hint="Tool archive" icon={Archive} delay={0.05} />
        <OpsStatCard
          label="Başarı oranı"
          value={`${stats.rate}%`}
          hint={`${stats.ok} başarılı · ${stats.fail} hata`}
          icon={CheckCircle2}
          tone={stats.rate >= 90 ? "success" : stats.fail > 0 ? "warning" : "default"}
          delay={0.1}
        />
        <OpsStatCard label="Request log" value={logs.length} hint="Son HTTP istekleri" icon={Server} delay={0.15} />
        <OpsStatCard
          label="4xx/5xx"
          value={stats.errLogs}
          hint="Hatalı HTTP yanıtları"
          icon={Activity}
          tone={stats.errLogs > 0 ? "danger" : "success"}
          delay={0.2}
        />
      </OpsStatGrid>

      <OpsToolbar>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Plugin, işlem veya path ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-xl border-border/50 bg-background/60 pl-9"
          />
        </div>
        <Input
          placeholder="Plugin filtresi"
          value={plugin}
          onChange={(e) => setPlugin(e.target.value)}
          className="h-9 w-full max-w-[160px] rounded-xl border-border/50 bg-background/60"
        />
        <Select value={limit} onValueChange={setLimit}>
          <SelectTrigger className="h-9 w-[88px] rounded-xl border-border/50 bg-background/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="200">200</SelectItem>
          </SelectContent>
        </Select>
        {archiveData?.source && (
          <Badge className="rounded-full font-mono text-[10px] border border-border/60 bg-muted/30">
            {archiveData.source}
          </Badge>
        )}
        <div className="ml-auto flex gap-1 rounded-full bg-muted/30 p-0.5">
          <OpsPill active={tab === "archive"} onClick={() => setTab("archive")}>
            Tool Archive
          </OpsPill>
          <OpsPill active={tab === "requests"} onClick={() => setTab("requests")}>
            Request Logs
          </OpsPill>
        </div>
      </OpsToolbar>

      {tab === "archive" ? (
        <OpsPanel
          title="Tool Archive"
          description="Plugin işlemleri, süre ve metadata detayları"
          noPadding
        >
          {archiveLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Archive className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">Kayıt bulunamadı</p>
              <p className="text-xs text-muted-foreground">Filtreleri gevşet veya limit artır</p>
            </div>
          ) : (
            <div className="space-y-2 p-3 sm:p-4">
              {filteredEntries.map((e, i) => (
                <AuditRow key={`${e.timestamp}-${e.operation}-${i}`} entry={e} index={i} />
              ))}
            </div>
          )}
        </OpsPanel>
      ) : (
        <OpsPanel title="Request Logs" description="HTTP method, path ve status kodları" noPadding>
          {logsLoading ? (
            <div className="p-4">
              <Skeleton className="h-32 rounded-xl" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Server className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">Request log yok</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredLogs.map((l, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.015, 0.15) }}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-muted/20 sm:flex-nowrap"
                >
                  <span className="flex w-36 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTime(String(l.timestamp || ""))}
                  </span>
                  <OpsMethodBadge method={l.method} />
                  <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/90">{l.path}</code>
                  <span className={cn("shrink-0 font-mono text-xs font-semibold tabular-nums", statusTone(l.status))}>
                    {l.status}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </OpsPanel>
      )}
    </OpsPageShell>
  );
}
