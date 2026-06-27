import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Copy,
  Globe,
  Network,
  Router,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/branding";
import { useToast } from "@/providers/ToastProvider";

type GuideStep = {
  title: string;
  body: string;
  code?: string;
};

function GuideStepCard({
  index,
  step,
  onCopy,
}: {
  index: number;
  step: GuideStep;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {index}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium leading-snug">{step.title}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{step.body}</p>
          {step.code && (
            <div className="relative rounded-lg border border-border/60 bg-muted/30 p-2.5 pr-10">
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                {step.code}
              </pre>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7"
                onClick={() => onCopy(step.code!, "Komut")}
                aria-label="Kopyala"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STATIC_IP_STEPS: GuideStep[] = [
  {
    title: "Mac'te kurulum",
    body: "Repo içindeki mcp-server klasöründe bir kez çalıştırın.",
    code: "cd mcp-server\nnpm run sidecar:install",
  },
  {
    title: "Ayar dosyası",
    body: "Sabit IP'nizi ve dışarıdan dinlemeyi açın. Token'ı pair sonrası eklersiniz.",
    code: `# ~/.config/felix-desktop/env\nSIDECAR_PORT=9477\nSIDECAR_BIND=0.0.0.0\nSIDECAR_PUBLIC_URL=http://SABIT_IP:9477\nSIDECAR_AUTH_TOKEN=\nFELIX_HUB_URL=https://asistan.huseyinalav.com`,
  },
  {
    title: "Mac yerel IP'sini bul",
    body: "Modem port yönlendirmede bu IP'yi kullanacaksınız.",
    code: "ipconfig getifaddr en0",
  },
  {
    title: "Modem port yönlendirme",
    body: "Modem arayüzünde Port Forward / NAT / Sanal Sunucu bölümüne gidin. Dış 9477 → Mac yerel IP → iç 9477 (TCP).",
  },
  {
    title: "PM2 ile arka planda çalıştır",
    body: "Terminal açık tutmanıza gerek kalmaz. Önce çalışan daemon varsa durdurun.",
    code: "npm run sidecar:pm2:start\npm2 save && pm2 startup",
  },
  {
    title: "Dışarıdan test",
    body: "Telefon WiFi kapalı, mobil veri açık — tarayıcıda açın. JSON cevap gelmeli.",
    code: "curl http://SABIT_IP:9477/health",
  },
  {
    title: "Hub'da eşleştir",
    body: "Bu sayfadaki formdan kod üretin → base URL = http://SABIT_IP:9477 → token'ı env dosyasına yazın → PM2 restart.",
    code: "npm run sidecar:pm2:restart",
  },
];

const TUNNEL_STEPS: GuideStep[] = [
  {
    title: "Kurulum + daemon",
    body: "Tunnel için SIDECAR_BIND varsayılan 127.0.0.1 kalabilir.",
    code: "cd mcp-server\nnpm run sidecar:install\nnpm run sidecar:daemon",
  },
  {
    title: "Tunnel aç",
    body: "İkinci terminalde cloudflared veya ngrok public HTTPS URL üretir.",
    code: "brew install cloudflared   # yoksa\nnpm run sidecar:tunnel",
  },
  {
    title: "Pair base URL",
    body: "Çıkan https://xxxx.trycloudflare.com adresini kopyalayın — 127.0.0.1 değil.",
  },
  {
    title: "Token kaydet",
    body: "Pair sonrası authToken'ı env dosyasına yazın ve daemon'u yeniden başlatın.",
    code: "SIDECAR_AUTH_TOKEN=<token>\nnpm run sidecar:pm2:restart",
  },
  {
    title: "Not",
    body: "Tunnel her kapanınca URL değişir; yeni URL ile tekrar pair gerekir. Sabit IP varsa tunnel şart değil.",
  },
];

const TROUBLESHOOT = [
  {
    q: "Çevrimiçi ama screenshot çalışmıyor",
    a: "Bağlantı tamam; macOS Ekran Kaydı izni eksik. Ayarlar → Gizlilik → Ekran Kaydı → node (PM2 ile çalışan) açın, sidecar'ı yeniden başlatın.",
  },
  {
    q: "Chat Documents listelemiyor",
    a: "Hub Mac'inize ulaşamıyordu veya henüz çevrimiçi değildi. Çevrimiçi ise /file list ~/Documents (Telegram) veya sohbeti yeniden deneyin.",
  },
  {
    q: "Çevrimdışı görünüyor",
    a: "PM2 çalışıyor mu? Dışarıdan health testi yapın. Modem port 9477 açık mı?",
  },
  {
    q: "401 unauthorized",
    a: "SIDECAR_AUTH_TOKEN yanlış veya eksik. Env dosyasını kontrol edip sidecar'ı yeniden başlatın.",
  },
  {
    q: "Daemon token olmadan başlamıyor",
    a: "Önce hub'da pair edin (daemon kapalı olabilir), token alın, sonra SIDECAR_BIND=0.0.0.0 ile başlatın.",
  },
];

type FelixDesktopConnectionGuideProps = {
  className?: string;
  defaultTab?: "static" | "tunnel";
};

export function FelixDesktopConnectionGuide({
  className,
  defaultTab = "static",
}: FelixDesktopConnectionGuideProps) {
  const toast = useToast();
  const [tab, setTab] = useState(defaultTab);
  const hubOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://asistan.huseyinalav.com";

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.show(`${label} kopyalandı`);
    } catch {
      toast.show("Kopyalama başarısız", "error");
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-border/80 bg-gradient-to-b from-card/90 to-card/50 shadow-lg backdrop-blur-sm",
        className,
      )}
    >
      <div className="border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Bağlantı rehberi</h2>
            <p className="text-[11px] text-muted-foreground">
              {BRAND.desktopAgentName} ↔ {BRAND.hubName}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Hub sunucuda, dosyalar Mac&apos;inizde. Hub&apos;ın Mac&apos;e ulaşması için aşağıdaki yollardan
          birini tamamlayın.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "static" | "tunnel")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="static" className="gap-1.5 text-xs">
              <Router className="h-3.5 w-3.5" />
              Sabit IP
            </TabsTrigger>
            <TabsTrigger value="tunnel" className="gap-1.5 text-xs">
              <Globe className="h-3.5 w-3.5" />
              Tunnel
            </TabsTrigger>
          </TabsList>

          <TabsContent value="static" className="mt-4 space-y-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
              Sabit IP varsa önerilen yol — tunnel gerekmez.
            </div>
            {STATIC_IP_STEPS.map((step, i) => (
              <GuideStepCard key={step.title} index={i + 1} step={step} onCopy={copyText} />
            ))}
          </TabsContent>

          <TabsContent value="tunnel" className="mt-4 space-y-3">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Port açamıyorsanız veya CGNAT varsa kullanın.
            </div>
            {TUNNEL_STEPS.map((step, i) => (
              <GuideStepCard key={step.title} index={i + 1} step={step} onCopy={copyText} />
            ))}
          </TabsContent>
        </Tabs>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            macOS izinleri (çevrimiçi olsa bile gerekli)
          </p>
          <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2.5 text-xs">
            <p className="font-medium text-violet-100">Ekran Kaydı</p>
            <p className="mt-1 text-muted-foreground">
              Screenshot için: Sistem Ayarları → Gizlilik ve Güvenlik → Ekran Kaydı →{" "}
              <code className="text-foreground">node</code> (PM2 kullanıyorsanız) veya Terminal
            </p>
            <p className="mt-2 font-medium text-violet-100">Erişilebilirlik</p>
            <p className="mt-1 text-muted-foreground">
              Tıklama/yazma için: Gizlilik → Erişilebilirlik → node
            </p>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              which node → çıkan yolu listede arayın
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sorun giderme
          </p>
          {TROUBLESHOOT.map((item) => (
            <div
              key={item.q}
              className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs"
            >
              <p className="font-medium">{item.q}</p>
              <p className="mt-1 text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 text-[11px] text-muted-foreground">
          <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Hub adresi: <code className="text-foreground">{hubOrigin}</code>
          </span>
        </div>
      </div>
    </div>
  );
}

export function FelixDesktopChecklist({ ready }: { ready: boolean }) {
  const items = [
    "Sidecar PM2 veya daemon çalışıyor",
    "Port forward veya tunnel aktif",
    "Hub'da cihaz eşleştirildi",
    "SIDECAR_AUTH_TOKEN kayıtlı",
  ];

  return (
    <ul className="space-y-2">
      {items.map((label) => (
        <li key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
          {ready ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Circle className="h-3.5 w-3.5 opacity-40" />
          )}
          {label}
        </li>
      ))}
    </ul>
  );
}
