import { Link } from "react-router-dom";
import {
  BookOpen,
  Bot,
  Flower2,
  Home,
  Inbox,
  MessageSquare,
  Settings,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_SHELL_WIDE } from "@/components/layout/page-layout";
import { SettingsInfoBox } from "@/components/settings/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND } from "@/lib/branding";
import { getHubOrigin, hubLabel, hubUrl, isLocalHub, productionHubUrl } from "@/lib/hub-url";
import { cn } from "@/lib/utils";

type GuideSection = {
  id: string;
  title: string;
  icon: LucideIcon;
  summary: string;
  bullets: string[];
  paths: Array<{ label: string; href: string }>;
};

const SECTIONS: GuideSection[] = [
  {
    id: "overview",
    title: "Felix Hub nedir?",
    icon: Sparkles,
    summary: `${BRAND.hubName}, kişisel ve proje odaklı bir agent işletim sistemidir. Sohbet, run'lar, onaylar, brifing, Telegram ve masaüstü sidecar tek merkezden yönetilir.`,
    bullets: [
      `${BRAND.assistantName} — asistan yüzü; modlar ve günlük özet.`,
      "Agent run'ları tool çağırır; riskli adımlar Onay Merkezi'nde bekler.",
      "Kişisel OS: RSS/IMAP/Gmail brifing, sabah digest, Telegram, life agent'lar.",
      "Agent Ekosistemi (V6): mağaza, skill, watcher, sandbox.",
    ],
    paths: [{ label: "Bugün", href: "/" }],
  },
  {
    id: "today",
    title: "Bugün",
    icon: Home,
    summary: "Günlük komuta merkezi — özet, sayaçlar, brifing, tercih hafızası, acil durdurma.",
    bullets: [
      "Brifing üret — hub + harici kaynaklardan günlük özet.",
      "Önerilen aksiyonlar — onay, failed run, inbox linkleri.",
      "Felix modları — iş / kişisel / alışveriş / odak.",
      "Tercih kaydet — agent'ların kullanacağı kısa hafıza.",
    ],
    paths: [
      { label: "Bugün", href: "/" },
      { label: "Kişisel OS", href: "/settings?tab=personal" },
    ],
  },
  {
    id: "life",
    title: "Life Agents",
    icon: Flower2,
    summary: "Günlük hayat agent profilleri: mail, haber, alışveriş, hatırlatıcı.",
    bullets: [
      "Preset'ten agent oluştur; test ile dene.",
      "Alışveriş araştırması ürün önerileri döner.",
      "Watcher ve zamanlayıcılarla genişletilebilir.",
    ],
    paths: [{ label: "Life", href: "/life" }],
  },
  {
    id: "chat",
    title: "Sohbet",
    icon: MessageSquare,
    summary: "LLM + tool erişimi; proje bağlamı ve policy burada devreye girer.",
    bullets: [
      "Router model seçer; tool çağrıları onay politikasından geçer.",
      "Sesli giriş destekleyen tarayıcılarda Bugün'den açılır.",
      "Uzun işler için Runs sayfasını izleyin.",
    ],
    paths: [{ label: "Sohbet", href: "/chat" }],
  },
  {
    id: "runs-approvals",
    title: "Runs & Onaylar",
    icon: ShieldCheck,
    summary: "Çalışan agent'lar, bekleyen onaylar ve karar geçmişi.",
    bullets: [
      "Runs — hedef, adımlar, log; durdurma/yeniden başlatma.",
      "Onay Merkezi — risk skoru, maskelenmiş önizleme, karar.",
      "Telegram /approve, /deny aynı kuyruk.",
      "Hub pause (/stop) otonom işleri durdurur.",
    ],
    paths: [
      { label: "Runs", href: "/runs" },
      { label: "Onaylar", href: "/approvals" },
      { label: "Inbox", href: "/inbox" },
    ],
  },
  {
    id: "settings",
    title: "Ayarlar & hesap",
    icon: Settings,
    summary: "LLM, entegrasyonlar, Kişisel OS, Felix Desktop, hesap.",
    bullets: [
      "Hesabım — ad ve şifre (oturum girişi).",
      "Kişisel OS — RSS, IMAP, Gmail OAuth, sabah digest, Telegram log.",
      "Entegrasyonlar — plugin env anahtarları.",
    ],
    paths: [
      { label: "Ayarlar", href: "/settings" },
      { label: "Hesabım", href: "/settings?tab=account" },
    ],
  },
  {
    id: "ecosystem",
    title: "Agent Ekosistemi",
    icon: Bot,
    summary: "V6: mağaza, skill, multi-agent, watcher, sandbox, trust.",
    bullets: [
      "App Store — paket kur/kaldır.",
      "Watchers — tetikleyicili hafif agent'lar.",
      "Sandbox — risksiz deneme.",
    ],
    paths: [{ label: "Ekosistem", href: "/v6" }],
  },
  {
    id: "ops",
    title: "Workflow & ops",
    icon: Workflow,
    summary: "Workflow designer, projeler, runbook, kullanım.",
    bullets: [
      "Workflow — şablon ve template run.",
      "Projeler — bağlam ve command center.",
      "Ops — cron, SLA, runbook.",
    ],
    paths: [
      { label: "Workflow", href: "/workflows/designer" },
      { label: "Projeler", href: "/projects" },
      { label: "Ops", href: "/ops" },
    ],
  },
  {
    id: "telegram",
    title: "Telegram",
    icon: Inbox,
    summary: "Uzaktan brifing, onay ve pause.",
    bullets: [
      "/brief — günlük özet.",
      "/runs, /approve, /deny, /stop, /resume.",
      "/remember, /memory — tercihler.",
      "Sabah digest — Kişisel OS zamanlama.",
    ],
    paths: [{ label: "Kişisel OS", href: "/settings?tab=personal" }],
  },
];

export function GuidePage() {
  const origin = getHubOrigin();
  const local = isLocalHub();

  return (
    <div className={cn(PAGE_SHELL_WIDE, "space-y-8 pb-8")}>
      <PageHeader
        title="Rehber"
        description={`${BRAND.hubName} — ne işe yarar, nereden erişilir, nasıl kullanılır.`}
        actions={
          <Badge variant="outline" className="font-mono text-xs">
            {hubLabel()}
          </Badge>
        }
      />

      <SettingsInfoBox variant="tip" title="Hub adresi">
        <strong>{local ? "Yerel geliştirme" : "Canlı ortam"}</strong> —{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{origin}</code>
        {!local && (
          <>
            {" "}
            · Production:{" "}
            <a href={productionHubUrl()} className="text-primary hover:underline">
              {productionHubUrl()}
            </a>
          </>
        )}
        {local && (
          <p className="mt-2 text-xs">
            Yerelde <code className="text-xs">npm run hub:live</code> →{" "}
            <code className="text-xs">http://localhost:8787</code>. Deploy sonrası aynı yollar domain altında
            çalışır.
          </p>
        )}
      </SettingsInfoBox>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav className="hidden lg:block">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            İçindekiler
          </p>
          <ul className="sticky top-20 space-y-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.id} id={section.id} className="scroll-mt-24">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{section.summary}</p>
                  <ul className="space-y-2 text-sm">
                    {section.bullets.map((b) => (
                      <li key={b} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    {section.paths.map((p) => (
                      <Button key={p.href} size="sm" variant="outline" asChild>
                        <Link to={p.href}>{p.label}</Link>
                      </Button>
                    ))}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {section.paths.map((p) => hubUrl(p.href)).join(" · ")}
                  </p>
                </CardContent>
              </Card>
            );
          })}

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4" />
                API örnekleri
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-xl border bg-background/80 p-3 font-mono text-xs">
                {`POST ${hubUrl("/personal/briefing/generate")}\nPUT ${hubUrl("/personal/briefing/schedule")}\nGET  ${hubUrl("/health")}  (auth yok)`}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
