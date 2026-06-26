import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  Bell,
  Bot,
  Calendar,
  Coins,
  FolderKanban,
  Inbox,
  Mail,
  Newspaper,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BRAND } from "@/lib/branding";
import { Input } from "@/components/ui/input";
import { fetchPersonalCommandCenter, generatePersonalBriefing, rememberPersonalMemory, setPersonalAutonomyPreset, triggerPersonalEmergencyStop, clearPersonalEmergencyStop } from "@/lib/personal-api";
import { formatCostUsd, formatTokenCount } from "@/lib/usage-api";
import { formatTime } from "@/lib/utils";
import type { ComponentType } from "react";

function priorityVariant(p: string) {
  if (p === "critical" || p === "high") return "destructive" as const;
  if (p === "low") return "outline" as const;
  return "secondary" as const;
}

export function TodayPage() {
  const queryClient = useQueryClient();
  const [memKey, setMemKey] = useState("");
  const [memValue, setMemValue] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["personal-command-center"],
    queryFn: () => fetchPersonalCommandCenter({ scope: "personal" }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const briefing = data?.today;
  const dailyBriefing = data?.dailyBriefing;
  const stats = briefing?.stats;

  const generateMutation = useMutation({
    mutationFn: generatePersonalBriefing,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["personal-command-center"] });
    },
  });

  const rememberMutation = useMutation({
    mutationFn: () => rememberPersonalMemory(memKey.trim(), memValue.trim()),
    onSuccess: () => {
      setMemKey("");
      setMemValue("");
      void queryClient.invalidateQueries({ queryKey: ["personal-command-center"] });
    },
  });

  const autonomyMutation = useMutation({
    mutationFn: (presetId: string) => setPersonalAutonomyPreset(presetId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["personal-command-center"] });
    },
  });

  const emergencyStopMutation = useMutation({
    mutationFn: () => triggerPersonalEmergencyStop(60),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["personal-command-center"] });
    },
  });

  const emergencyResumeMutation = useMutation({
    mutationFn: () => clearPersonalEmergencyStop(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["personal-command-center"] });
    },
  });

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-4 sm:space-y-6">
      <PageHeader
        title="Bugün"
        description={`${BRAND.assistantName} kişisel komuta merkezi — ne önemli, ne bekliyor, agent ne istiyor.`}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              Brifing üret
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              Yenile
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatChip label="Inbox" value={stats?.unreadInbox ?? 0} icon={Inbox} href="/inbox" />
            <StatChip label="Onaylar" value={stats?.pendingApprovals ?? 0} icon={ShieldCheck} href="/approvals" />
            <StatChip label="Aktif run" value={stats?.activeRuns ?? 0} icon={Bot} href="/runs" />
            <StatChip label="Projeler" value={stats?.projects ?? 0} icon={FolderKanban} href="/projects" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sun className="h-4 w-4 text-amber-500" />
                  Günlük özet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-medium">{briefing?.summary}</p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {(briefing?.bullets ?? []).map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  {briefing?.date} · {data?.telegram.hint}
                </p>
              </CardContent>
            </Card>

            {(dailyBriefing?.items?.length ?? 0) > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Brifing maddeleri</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dailyBriefing?.items.slice(0, 10).map((item) => (
                    <Link
                      key={item.id}
                      to={item.href}
                      className="flex items-start justify-between gap-2 rounded-lg border p-2 hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{item.body}</p>
                      </div>
                      <Badge variant={item.actionRequired ? "destructive" : "secondary"}>
                        {item.importance}
                      </Badge>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Önerilen aksiyonlar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data?.suggestedActions ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Şu an önerilen aksiyon yok.</p>
                ) : (
                  data?.suggestedActions.map((action) => (
                    <Link
                      key={action.id}
                      to={action.href}
                      className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium">{action.title}</span>
                        <Badge variant={priorityVariant(action.priority)}>{action.priority}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{action.message}</p>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FeedCard
              title="Inbox"
              icon={Bell}
              href="/inbox"
              empty="Yeni bildirim yok"
              items={(data?.inbox.items ?? []).map((item) => ({
                id: item.id,
                title: item.title,
                meta: item.type,
                time: item.createdAt,
              }))}
            />
            <FeedCard
              title="Aktif run'lar"
              icon={Bot}
              href="/runs"
              empty="Aktif run yok"
              items={(data?.activeRuns ?? []).map((run) => ({
                id: run.id,
                title: run.goal || run.id.slice(0, 8),
                meta: run.status,
                time: run.startedAt,
              }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <PlaceholderCard title="Mail" icon={Mail} hint={data?.mail.hint} />
            <PlaceholderCard title="Haber" icon={Newspaper} hint={data?.news.hint} />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Coins className="h-4 w-4" />
                  Kullanım (7 gün)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data?.usage ? (
                  <>
                    <p>
                      <span className="text-muted-foreground">Maliyet:</span>{" "}
                      {formatCostUsd(data.usage.totalCostUsd)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Token:</span>{" "}
                      {formatTokenCount(data.usage.totalTokens)}
                    </p>
                    <Button variant="link" className="h-auto p-0" asChild>
                      <Link to="/usage">
                        Detay <ArrowRight className="ml-1 inline h-3 w-3" />
                      </Link>
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">Kullanım verisi yok.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                Güvenlik ve otonomi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                {(data?.autonomy?.presets ?? []).map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={data?.autonomy?.presetId === p.id ? "default" : "outline"}
                    disabled={autonomyMutation.isPending}
                    onClick={() => autonomyMutation.mutate(p.id)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <p className="text-muted-foreground">
                Seviye: {data?.autonomy?.level ?? "—"} · Desktop: {data?.autonomy?.desktopMode ?? "—"} · Sidecar:{" "}
                {data?.desktop?.sidecar.paired ? "eşleşmiş" : "yok"}
              </p>
              <div className="flex flex-wrap gap-2">
                {data?.ops?.emergencyStop ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={emergencyResumeMutation.isPending}
                    onClick={() => emergencyResumeMutation.mutate()}
                  >
                    Acil durdurmayı kaldır
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={emergencyStopMutation.isPending}
                    onClick={() => emergencyStopMutation.mutate()}
                  >
                    Acil durdur (60 dk)
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {(data?.memory.preferences.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Kişisel tercihler</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {data?.memory.preferences.map((p) => (
                  <Badge key={p.id} variant={p.pinned ? "default" : "secondary"}>
                    {p.key}: {String(p.value).slice(0, 40)}
                  </Badge>
                ))}
                <Button variant="outline" size="sm" asChild>
                  <Link to="/v6">Profil (V6)</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tercih ekle</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row">
              <Input placeholder="Anahtar (ör. briefing_style)" value={memKey} onChange={(e) => setMemKey(e.target.value)} />
              <Input placeholder="Değer" value={memValue} onChange={(e) => setMemValue(e.target.value)} />
              <Button
                size="sm"
                disabled={!memKey.trim() || !memValue.trim() || rememberMutation.isPending}
                onClick={() => rememberMutation.mutate()}
              >
                Kaydet
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Link to="/system" className="hover:text-primary">
              Sistem paneli →
            </Link>
            <span>·</span>
            <Link to="/chat" className="hover:text-primary">
              Sohbet
            </Link>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Send className="h-3 w-3" />
              Telegram: {data?.telegram.status}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function StatChip({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link to={href} className="group">
      <Card className="h-full transition-colors group-hover:border-primary/40">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function FeedCard({
  title,
  icon: Icon,
  href,
  items,
  empty,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  items: Array<{ id: string; title: string; meta: string; time?: string }>;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to={href}>Tümü</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2 border-b pb-2 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.meta}</p>
              </div>
              {item.time && (
                <span className="shrink-0 text-[10px] text-muted-foreground">{formatTime(item.time)}</span>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function PlaceholderCard({
  title,
  icon: Icon,
  hint,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{hint || "V7.2'de bağlanacak"}</p>
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Yakında
        </div>
      </CardContent>
    </Card>
  );
}
