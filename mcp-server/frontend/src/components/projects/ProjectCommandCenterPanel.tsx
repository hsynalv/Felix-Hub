import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  GitBranch,
  Link2,
  MessageSquare,
  Search,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  askProject,
  fetchProjectCommandCenter,
  fetchProjectImpact,
} from "@/lib/project-api";
import { formatCostUsd, formatTokenCount } from "@/lib/usage-api";
import { formatTime } from "@/lib/utils";

export function ProjectCommandCenterPanel({ projectKey }: { projectKey: string }) {
  const [askQuery, setAskQuery] = useState("");
  const [impactPath, setImpactPath] = useState("");

  const ccQuery = useQuery({
    queryKey: ["project-command-center", projectKey],
    queryFn: () => fetchProjectCommandCenter(projectKey),
    enabled: !!projectKey,
  });

  const askMutation = useMutation({
    mutationFn: (q: string) => askProject(projectKey, q),
  });

  const impactMutation = useMutation({
    mutationFn: (path: string) => fetchProjectImpact(projectKey, path),
  });

  if (ccQuery.isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  const data = ccQuery.data;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Command Center
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Bugün · {data.briefing.date}
            </p>
            <p className="mt-1 text-sm font-medium">{data.briefing.summary}</p>
            {data.briefing.bullets.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {data.briefing.bullets.slice(0, 6).map((b, i) => (
                  <li key={i}>• {b}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Bugün run" value={data.briefing.stats.runs} />
            <MiniStat label="Bekleyen onay" value={data.pendingApprovals.length} />
            <MiniStat label="Risk" value={data.risks.length} warn={data.risks.length > 0} />
            <MiniStat
              label="7g maliyet"
              value={formatCostUsd(data.usage.last7Days?.estimatedCostUsd ?? 0)}
              text
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4" />
              Entegrasyonlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.integrations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bağlı entegrasyon yok.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.integrations.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <span className="line-clamp-1">{item.label}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {item.connected ? "bağlı" : "yok"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Aktif riskler
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.risks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aktif risk yok.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.risks.slice(0, 5).map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-border/50 px-3 py-2"
                  >
                    <AlertTriangle
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${r.level === "high" ? "text-destructive" : "text-amber-500"}`}
                    />
                    <div>
                      <Badge variant="outline" className="text-[10px]">
                        {r.type}
                      </Badge>
                      <p className="mt-1 line-clamp-2">{r.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {data.pendingApprovals.length > 0 && (
              <Button size="sm" variant="outline" className="mt-3" asChild>
                <Link to="/approvals">Onay merkezi ({data.pendingApprovals.length})</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Maliyet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <CostRow label="Son 7 gün" totals={data.usage.last7Days} />
            <CostRow label="Son 30 gün" totals={data.usage.last30Days} />
            {data.quota?.warning && (
              <p className="text-xs text-amber-600">Kota uyarısı — kullanım limitine yaklaşılıyor.</p>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link to="/usage">Detaylı kullanım</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4" />
              GitHub aktivitesi
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.githubActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Son GitHub olayı yok.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.githubActivity.map((ev) => (
                  <li key={ev.id} className="rounded-lg border border-border/50 px-3 py-2">
                    <div className="flex justify-between gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {ev.eventType}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{formatTime(ev.occurredAt)}</span>
                    </div>
                    {ev.summary && <p className="mt-1 line-clamp-2 text-muted-foreground">{ev.summary}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notion / Obsidian</CardTitle>
          </CardHeader>
          <CardContent>
            {data.knowledgeActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bilgi tabanı aktivitesi yok.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.knowledgeActivity.map((ev) => (
                  <li key={ev.id} className="rounded-lg border border-border/50 px-3 py-2">
                    <Badge variant="outline" className="text-[10px]">
                      {ev.eventType}
                    </Badge>
                    {ev.summary && <p className="mt-1 line-clamp-2">{ev.summary}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Bu hedef için context
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={askQuery}
                onChange={(e) => setAskQuery(e.target.value)}
                placeholder="Örn: auth refactor için ne biliyoruz?"
                className="text-sm"
              />
              <Button
                size="sm"
                disabled={!askQuery.trim() || askMutation.isPending}
                onClick={() => askMutation.mutate(askQuery.trim())}
              >
                <Search className="h-3.5 w-3.5" />
              </Button>
            </div>
            {askMutation.data?.snippets && askMutation.data.snippets.length > 0 && (
              <ul className="space-y-2 text-sm">
                {(askMutation.data.snippets as Array<{ type?: string; text?: string }>).slice(0, 5).map((s, i) => (
                  <li key={i} className="rounded border border-border/50 px-2 py-1.5 text-muted-foreground">
                    {s.type && (
                      <Badge variant="outline" className="mr-2 text-[10px]">
                        {s.type}
                      </Badge>
                    )}
                    {s.text}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Path etkisi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={impactPath}
                onChange={(e) => setImpactPath(e.target.value)}
                placeholder="src/auth/login.ts"
                className="font-mono text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!impactPath.trim() || impactMutation.isPending}
                onClick={() => impactMutation.mutate(impactPath.trim())}
              >
                Analiz
              </Button>
            </div>
            {impactMutation.data && (
              <p className="text-sm text-muted-foreground">
                {impactMutation.data.events?.length ?? 0} olay,{" "}
                {impactMutation.data.edges?.length ?? 0} graph kenarı eşleşti.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  warn,
  text,
}: {
  label: string;
  value: number | string;
  warn?: boolean;
  text?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${warn ? "text-destructive" : ""} ${text ? "text-base" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function CostRow({
  label,
  totals,
}: {
  label: string;
  totals?: { estimatedCostUsd?: number; totalTokens?: number };
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">
        {formatCostUsd(totals?.estimatedCostUsd ?? 0)} · {formatTokenCount(totals?.totalTokens ?? 0)} tok
      </span>
    </div>
  );
}
