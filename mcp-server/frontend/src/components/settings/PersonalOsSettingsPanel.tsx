import { useState } from "react";
import { CalendarClock, Loader2, Mail, Newspaper, RefreshCw, Send, Trash2, Zap } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingsInfoBox, SettingsSectionCard } from "@/components/settings/shared";
import {
  addBriefingFeed,
  addBriefingImapAccount,
  fetchBriefingFeeds,
  fetchBriefingGmailAccounts,
  fetchBriefingImapAccounts,
  fetchBriefingSchedule,
  fetchGmailOAuthUrl,
  fetchTelegramOutbound,
  removeBriefingFeed,
  removeBriefingGmailAccount,
  removeBriefingImapAccount,
  runBriefingScheduleNow,
  testBriefingSource,
  updateBriefingSchedule,
} from "@/lib/personal-api";
import { useToast } from "@/providers/ToastProvider";

function formatTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("tr-TR");
  } catch {
    return iso;
  }
}

function parseCronHourMinute(cronExpr?: string) {
  const parts = String(cronExpr || "0 9 * * *").trim().split(/\s+/);
  if (parts.length !== 5) return { hour: 9, minute: 0 };
  return { minute: parseInt(parts[0], 10) || 0, hour: parseInt(parts[1], 10) || 9 };
}

export function PersonalOsSettingsPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [feedUrl, setFeedUrl] = useState("");
  const [feedLabel, setFeedLabel] = useState("");
  const [imapHost, setImapHost] = useState("imap.gmail.com");
  const [imapUser, setImapUser] = useState("");
  const [imapLabel, setImapLabel] = useState("Gmail");

  const feedsQ = useQuery({ queryKey: ["briefing-feeds"], queryFn: fetchBriefingFeeds });
  const imapQ = useQuery({ queryKey: ["briefing-imap"], queryFn: fetchBriefingImapAccounts });
  const gmailQ = useQuery({ queryKey: ["briefing-gmail"], queryFn: fetchBriefingGmailAccounts });
  const scheduleQ = useQuery({ queryKey: ["briefing-schedule"], queryFn: fetchBriefingSchedule });
  const outboundQ = useQuery({
    queryKey: ["telegram-outbound"],
    queryFn: () => fetchTelegramOutbound(80),
    refetchInterval: 30_000,
  });

  const invalidateBriefing = () => {
    queryClient.invalidateQueries({ queryKey: ["briefing-feeds"] });
    queryClient.invalidateQueries({ queryKey: ["briefing-imap"] });
    queryClient.invalidateQueries({ queryKey: ["briefing-gmail"] });
    queryClient.invalidateQueries({ queryKey: ["briefing-schedule"] });
    queryClient.invalidateQueries({ queryKey: ["personal-command-center"] });
  };

  const schedule = scheduleQ.data;
  const cronParts = parseCronHourMinute(schedule?.cronExpr);
  const [scheduleHour, setScheduleHour] = useState("9");
  const [scheduleMinute, setScheduleMinute] = useState("0");

  const scheduleMut = useMutation({
    mutationFn: updateBriefingSchedule,
    onSuccess: () => {
      invalidateBriefing();
      toast.show("Brifing zamanlaması güncellendi");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const runScheduleMut = useMutation({
    mutationFn: runBriefingScheduleNow,
    onSuccess: (data) => {
      invalidateBriefing();
      outboundQ.refetch();
      toast.show(data.fired ? `Brifing üretildi (${data.itemCount ?? 0} madde)` : "Zamanlama atlandı");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const gmailConnectMut = useMutation({
    mutationFn: fetchGmailOAuthUrl,
    onSuccess: (data) => {
      window.open(data.url, "_blank", "noopener,noreferrer");
      toast.show("Google OAuth penceresi açıldı — izin verip geri dönün");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const addFeedMut = useMutation({
    mutationFn: () => addBriefingFeed({ url: feedUrl.trim(), label: feedLabel.trim() || undefined }),
    onSuccess: () => {
      setFeedUrl("");
      setFeedLabel("");
      invalidateBriefing();
      toast.show("RSS feed eklendi");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const removeFeedMut = useMutation({
    mutationFn: removeBriefingFeed,
    onSuccess: () => {
      invalidateBriefing();
      toast.show("Feed kaldırıldı");
    },
  });

  const addImapMut = useMutation({
    mutationFn: () =>
      addBriefingImapAccount({
        host: imapHost.trim(),
        user: imapUser.trim(),
        passwordEnvKey: "BRIEFING_IMAP_PASS",
        label: imapLabel.trim() || imapUser.trim(),
      }),
    onSuccess: () => {
      invalidateBriefing();
      toast.show("IMAP hesabı eklendi");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const removeImapMut = useMutation({
    mutationFn: removeBriefingImapAccount,
    onSuccess: () => {
      invalidateBriefing();
      toast.show("IMAP hesabı kaldırıldı");
    },
  });

  const removeGmailMut = useMutation({
    mutationFn: removeBriefingGmailAccount,
    onSuccess: () => {
      invalidateBriefing();
      toast.show("Gmail hesabı kaldırıldı");
    },
  });

  const testMut = useMutation({
    mutationFn: ({ type, id }: { type: "rss" | "imap" | "gmail"; id: string }) => testBriefingSource(type, id),
    onSuccess: (data) => toast.show(data.itemCount != null ? `Test OK (${data.itemCount} öğe)` : "Bağlantı OK"),
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const feeds = feedsQ.data?.feeds ?? [];
  const accounts = imapQ.data?.accounts ?? [];
  const gmailAccounts = gmailQ.data?.accounts ?? [];
  const gmailOAuthConfigured = gmailQ.data?.oauthConfigured ?? false;
  const messages = outboundQ.data?.messages ?? [];

  return (
    <div className="space-y-6">
      <SettingsSectionCard
        icon={CalendarClock}
        title="Sabah brifing zamanlaması"
        description="Her gün belirlenen saatte brifing üretilir ve isteğe bağlı Telegram digest gönderilir."
      >
        <SettingsInfoBox variant="tip" title="Telegram digest">
          <code className="text-xs">TELEGRAM_BOT_TOKEN</code> ve <code className="text-xs">TELEGRAM_CHAT_ID</code>{" "}
          ayarlı olmalı. Gönderilen mesajlar aşağıdaki giden mesaj kaydında görünür.
        </SettingsInfoBox>

        {scheduleQ.isLoading ? (
          <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Zamanlama aktif</p>
                <p className="text-xs text-muted-foreground">Varsayılan 09:00 Europe/Istanbul</p>
              </div>
              <Switch
                checked={!!schedule?.enabled}
                onCheckedChange={(enabled) => scheduleMut.mutate({ enabled })}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Saat</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={scheduleHour || String(cronParts.hour)}
                  onChange={(e) => setScheduleHour(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Dakika</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={scheduleMinute || String(cronParts.minute)}
                  onChange={(e) => setScheduleMinute(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Saat dilimi</Label>
                <Input
                  value={schedule?.timezone || "Europe/Istanbul"}
                  onChange={(e) => scheduleMut.mutate({ timezone: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  scheduleMut.mutate({
                    hour: parseInt(scheduleHour || String(cronParts.hour), 10),
                    minute: parseInt(scheduleMinute || String(cronParts.minute), 10),
                  })
                }
              >
                Saati kaydet
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => scheduleMut.mutate({ pushTelegram: !schedule?.pushTelegram })}
              >
                Telegram: {schedule?.pushTelegram ? "açık" : "kapalı"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => scheduleMut.mutate({ actionRequiredOnly: !schedule?.actionRequiredOnly })}
              >
                Sadece aksiyon: {schedule?.actionRequiredOnly ? "evet" : "hayır"}
              </Button>
              <Button size="sm" onClick={() => runScheduleMut.mutate()} disabled={runScheduleMut.isPending}>
                Şimdi çalıştır
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Son çalışma: {formatTime(schedule?.lastRunAt)} · Son Telegram: {formatTime(schedule?.lastPushAt)} ·
              Sıradaki: {formatTime(schedule?.nextRunAt)}
            </p>
          </div>
        )}
      </SettingsSectionCard>

      <SettingsSectionCard
        icon={Newspaper}
        title="Haber kaynakları (RSS)"
        description="Günlük brifing ve Bugün sayfası haber widget'ı bu feed'lerden beslenir."
      >
        <SettingsInfoBox variant="tip" title="Nasıl çalışır?">
          Her feed URL'si periyodik olarak okunur; başlıklar brifinge eklenir. Feed ekledikten sonra Bugün
          sayfasında &quot;Brifing üret&quot; veya Telegram&apos;da <code className="text-xs">/brief</code> ile
          test edebilirsiniz.
        </SettingsInfoBox>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="feed-url">Feed URL</Label>
            <Input
              id="feed-url"
              placeholder="https://feeds.bbci.co.uk/news/rss.xml"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="feed-label">Etiket (opsiyonel)</Label>
            <Input id="feed-label" placeholder="BBC News" value={feedLabel} onChange={(e) => setFeedLabel(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => addFeedMut.mutate()} disabled={!feedUrl.trim() || addFeedMut.isPending}>
              Ekle
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {feedsQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : feeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz RSS feed yok.</p>
          ) : (
            feeds.map((f) => (
              <div key={f.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{f.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{f.url}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Son: {formatTime(f.lastFetchedAt)}
                    {f.lastError && <span className="text-destructive"> · {f.lastError}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="outline" onClick={() => testMut.mutate({ type: "rss", id: f.id })}>
                    <Zap className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeFeedMut.mutate(f.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        icon={Mail}
        title="Gmail (OAuth)"
        description="Uygulama şifresi yerine Google OAuth ile okuma erişimi. Refresh token hub store'da tutulur."
      >
        <SettingsInfoBox variant="warning" title="OAuth yapılandırması">
          <code className="text-xs">GMAIL_OAUTH_CLIENT_ID</code> ve{" "}
          <code className="text-xs">GMAIL_OAUTH_CLIENT_SECRET</code> env&apos;de olmalı. Google Cloud Console&apos;da
          redirect URI: <code className="text-xs">http://localhost:8787/personal/briefing/gmail/oauth/callback</code>
        </SettingsInfoBox>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => gmailConnectMut.mutate()}
            disabled={!gmailOAuthConfigured || gmailConnectMut.isPending}
          >
            Gmail bağla
          </Button>
          <Button variant="outline" size="sm" onClick={() => gmailQ.refetch()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Listeyi yenile
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {gmailQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : gmailAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz Gmail OAuth hesabı yok.</p>
          ) : (
            gmailAccounts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Son: {formatTime(a.lastFetchedAt)}
                    {a.lastError && <span className="text-destructive"> · {a.lastError}</span>}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => testMut.mutate({ type: "gmail", id: a.id })}>
                    <Zap className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeGmailMut.mutate(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        icon={Mail}
        title="Mail kaynağı (IMAP)"
        description="Önemli mailler brifinge eklenir. Şifre asla burada saklanmaz."
      >
        <SettingsInfoBox variant="warning" title="Şifre env'de">
          <code className="text-xs">BRIEFING_IMAP_PASS</code> değerini Entegrasyonlar veya{" "}
          <code className="text-xs">.env</code> dosyasına yazın (Gmail için uygulama şifresi). Hesap kaydı yalnızca
          host ve kullanıcı adını tutar.
        </SettingsInfoBox>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>IMAP sunucu</Label>
            <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>E-posta</Label>
            <Input type="email" value={imapUser} onChange={(e) => setImapUser(e.target.value)} placeholder="you@gmail.com" />
          </div>
          <div className="space-y-1">
            <Label>Etiket</Label>
            <Input value={imapLabel} onChange={(e) => setImapLabel(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => addImapMut.mutate()} disabled={!imapUser.trim() || addImapMut.isPending}>
              Hesap ekle
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {imapQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz IMAP hesabı yok.</p>
          ) : (
            accounts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.user} @ {a.host} · env: {a.passwordEnvKey}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Son: {formatTime(a.lastFetchedAt)}
                    {a.lastError && <span className="text-destructive"> · {a.lastError}</span>}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => testMut.mutate({ type: "imap", id: a.id })}>
                    <Zap className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeImapMut.mutate(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        icon={Send}
        title="Telegram giden mesajlar"
        description="Hub'ın Telegram'a gönderdiği tüm mesajların kaydı (komut yanıtları, bildirimler, onay klavyeleri)."
      >
        <div className="mb-3 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => outboundQ.refetch()} disabled={outboundQ.isFetching}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${outboundQ.isFetching ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>

        {outboundQ.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Henüz kayıtlı giden mesaj yok. Telegram bot token ve chat ID yapılandırıldığında mesajlar burada görünür.
          </p>
        ) : (
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg border p-3 text-sm ${m.success ? "" : "border-destructive/40 bg-destructive/5"}`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant={m.success ? "outline" : "destructive"}>{m.success ? "gönderildi" : "hata"}</Badge>
                  <Badge variant="outline">{m.source}</Badge>
                  {m.hasMarkup && <Badge variant="outline">inline keyboard</Badge>}
                  <span className="text-xs text-muted-foreground">{formatTime(m.sentAt)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-foreground">{m.preview || m.text}</p>
                {m.error && <p className="mt-1 text-xs text-destructive">{m.error}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">chat: {m.chatId}</p>
              </div>
            ))}
          </div>
        )}
      </SettingsSectionCard>
    </div>
  );
}
