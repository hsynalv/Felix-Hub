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

## Eski dokümantasyon

Önceki `docs/` altında roadmap, strategy, api-reference vb. onlarca dosya vardı. Bu yeni set **mevcut durum analizi** odaklıdır. Eski roadmap dosyalarına ihtiyaç varsa git geçmişinden geri alınabilir.
