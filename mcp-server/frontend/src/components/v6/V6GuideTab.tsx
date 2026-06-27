import { BookOpen } from "lucide-react";
import { OpsPanel } from "@/components/ops/OpsPrimitives";
import { SettingsInfoBox } from "@/components/settings/shared";

const SECTIONS = [
  {
    title: "Agent App Store",
    tab: "store",
    body: "Hazır agent paketlerini kurup kaldırırsınız. Her ürünün trust skoru, eval skoru ve tahmini maliyeti görünür. Kurulu agent'lar life automation ve runbook akışlarında kullanılabilir.",
  },
  {
    title: "Skills",
    tab: "skills",
    body: "Yeniden kullanılabilir agent becerileri. Derle (compile) ile prompt/şablon üretir; dry-run ile gerçek yazma yapmadan test edersiniz. Watchers ve multi-agent child run'lar skill şablonlarına bağlanabilir.",
  },
  {
    title: "Multi-Agent",
    tab: "multi",
    body: "Parent run oluşturup altında child run'lar spawn edersiniz. Rol (executor, reviewer…) ve template ile hiyerarşik agent işleri kurarsınız. Aggregate JSON ile parent altındaki tüm run durumunu görürsünüz.",
  },
  {
    title: "Watchers",
    tab: "watchers",
    body: "Olay veya zaman tetikleyicili hafif agent'lar. dryRun modunda güvenle test edilir; test-fire ile manuel tetiklenir. Life agent'ların scheduler bağlantısı için altyapı sağlar (V7 ile genişler).",
  },
  {
    title: "Sandbox",
    tab: "sandbox",
    body: "İzole deneme oturumları. Riskli tool veya workflow'ları production verisine dokunmadan dener. Oturum kapatılınca sandbox scope temizlenir.",
  },
  {
    title: "Trust",
    tab: "trust",
    body: "Skill, watcher ve agent varlıkları için güven skorları. Yeniden hesapla ile son run ve eval sonuçlarından skor güncellenir. Düşük trust'lı varlıklar watcher tetiklemesinde filtrelenebilir.",
  },
  {
    title: "NL Admin",
    tab: "nladmin",
    body: "Doğal dil ile yönetim komutları (ör. autonomy seviyesi). Önizle parse sonucunu gösterir; Uygula onaylı şekilde policy/ayar değiştirir.",
  },
  {
    title: "Compliance",
    tab: "compliance",
    body: "Uyumluluk paketi özeti — hangi policy, audit ve veri saklama kurallarının aktif olduğunu JSON rapor olarak görürsünüz.",
  },
  {
    title: "Conflicts",
    tab: "conflicts",
    body: "Bellek veya dokümanlarda çelişen bilgi taraması. Konu girerek workspace'te çakışan tercih/kuralları bulur.",
  },
  {
    title: "Profil",
    tab: "profile",
    body: "Operating model tercihleri (remember/forget). Sabitlenmiş (pinned) tercihler günlük brifing ve agent prompt'larına enjekte edilir. Kişisel memory için Bugün sayfası ve V7 /remember komutları da kullanılabilir.",
  },
];

export function V6GuideTab() {
  return (
    <OpsPanel title="Rehber — Agent Ekosistemi" icon={BookOpen}>
      <SettingsInfoBox variant="tip" title="Bu sayfa ne?">
        <strong>Agent Ekosistemi</strong>, V6 ile gelen ölçeklenebilir agent katmanıdır: mağaza, skill'ler,
        watcher'lar, sandbox, trust ve yönetim araçları tek yüzeyde toplanır. URL <code className="text-xs">/v6</code>{" "}
        tarihsel kısaltmadır; menüdeki adı <strong>Agent Ekosistemi</strong> olarak güncellendi.
      </SettingsInfoBox>

      <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
        Mühendislik odaklı günlük işler (run, onay, inbox) için <strong>Bugün</strong> ve{" "}
        <strong>Sistem Paneli</strong> kullanın; burada ise agent ekosistemini kurar, dener ve yönetirsiniz.
      </p>

      <ul className="mt-6 space-y-4">
        {SECTIONS.map((s) => (
          <li key={s.tab} className="rounded-lg border p-4">
            <p className="font-medium text-foreground">{s.title}</p>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          </li>
        ))}
      </ul>

      <SettingsInfoBox variant="default" title="İlgili sayfalar">
        <ul className="mt-1 list-inside list-disc text-sm space-y-1">
          <li>
            <strong>Ayarlar → Kişisel OS</strong> — RSS/IMAP brifing kaynakları, Telegram giden mesajlar
          </li>
          <li>
            <strong>Bugün</strong> — günlük özet, mail/haber widget'ları, Felix modları
          </li>
          <li>
            <strong>Life</strong> — günlük hayat agent profilleri
          </li>
        </ul>
      </SettingsInfoBox>
    </OpsPanel>
  );
}
