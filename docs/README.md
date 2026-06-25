# mcp-hub Documentation

> Son güncelleme: 2026-06-24 — tam sistem taraması + harici değerlendirme sentezi

Bu klasör, `docs/` silindikten sonra sıfırdan oluşturuldu. Amaç: kod tabanının gerçek durumunu, riskleri ve öncelikleri tek yerde toplamak.

## İçindekiler

| Dosya | İçerik |
|-------|--------|
| [assessment.md](./assessment.md) | Genel platform değerlendirmesi + harici yorumun cevabı |
| [architecture.md](./architecture.md) | Mimari özet, request flow, çift-stack problemi |
| [technical-debt.md](./technical-debt.md) | Teknik borç envanteri |
| [security.md](./security.md) | Güvenlik denetimi bulguları |
| [testing.md](./testing.md) | Test/CI durumu, exclude listesi, kapsam boşlukları |
| [plugins.md](./plugins.md) | 35 plugin uyumluluk matrisi (auth, meta, health) |
| [configuration.md](./configuration.md) | Config, env değişkenleri, auth/open mode, production checklist |
| [roadmap.md](./roadmap.md) | **Yol haritası** — 6 faz, zaman çizelgesi, exit gate'ler |
| [**v3-path/**](./v3-path/README.md) | **V3 strateji** — güvenli agent execution platformu, 10 pillar + uygulama sırası |
| [**v4-path/**](./v4-path/README.md) | **V4 strateji** — premium AI engineering agent (Designer + Desktop + Eval) |
| [**v5-path/**](./v5-path/README.md) | **V5 strateji** — managed autonomous operations (runbook, schedule, SLA) |
| [**v6-path/**](./v6-path/README.md) | **V6 strateji** — agent ekosistemi ölçeklenir (multi-agent, skill store, enterprise) |
| [**v7-path/**](./v7-path/README.md) | **V7 strateji** — personal AI operating system (briefing, Telegram, Jarvis) |
| [manual-test-pack.md](./manual-test-pack.md) | CI dışı integration testler — release checklist |

## Hızlı özet

**mcp-hub**, Express tabanlı bir AI-agent tool platformudur: REST API, MCP HTTP/STDIO, 35 plugin, policy/onay, audit, jobs, persistence, settings API ve React frontend aynı çatı altında.

| Metrik | Değer |
|--------|-------|
| Plugin sayısı | 35 |
| `plugin.meta.json` coverage | 35/35 |
| Aktif test dosyası | ~51 |
| Aktif test assertion | ~692 |
| Exclude edilen test dosyası | ~14 |
| Toplam test dosyası (disk) | ~50 |

**Genel yargı:** Ürünleşmeye çalışan ciddi bir platform; yeni özellikten önce standardizasyon ve güvenlik omurgası sadeleştirilmeli.

**Stratejik yön (V3):** "Daha çok plugin" yerine **güvenli, gözlemlenebilir, tekrar üretilebilir agent execution platformu**. Detay: [v3-path/README.md](./v3-path/README.md) → [EXECUTION-ORDER.md](./v3-path/EXECUTION-ORDER.md).

**Sonraki aşama (V4):** Run Designer + Desktop Control + Eval Studio ile **yerel bilgisayarda iş yapabilen AI engineering agent platformu**. Detay: [v4-path/README.md](./v4-path/README.md).

**Operasyon katmanı (V5):** Runbook, schedule, release/incident agent'ları, SLA ve env promotion — **managed autonomous operations**. Detay: [v5-path/README.md](./v5-path/README.md).

**Uzun vade (V6):** Multi-agent, skill store, watchers, App Store, compliance. Detay: [v6-path/README.md](./v6-path/README.md).

**Kişisel OS (V7):** Günlük brifing, Telegram kontrol, desktop/shopping assistant, Jarvis arayüzü. Detay: [v7-path/README.md](./v7-path/README.md).

## Eski dokümantasyon

Önceki `docs/` altında roadmap, strategy, api-reference vb. onlarca dosya vardı. Bu yeni set **mevcut durum analizi** odaklıdır. Eski roadmap dosyalarına ihtiyaç varsa git geçmişinden geri alınabilir.
