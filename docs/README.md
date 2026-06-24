# mcp-hub Dokümantasyon

AI ajanları için plugin tabanlı HTTP/MCP servisi **mcp-hub** platformunun resmi dokümantasyon dizinidir.

## Hızlı Başlangıç

| Belge | Açıklama |
|-------|----------|
| [getting-started.md](./getting-started.md) | Kurulum, ilk çalıştırma, sağlık kontrolü |
| [configuration.md](./configuration.md) | Ortam değişkenleri referansı |
| [api-reference.md](./api-reference.md) | REST API endpoint'leri |

## Mimari ve Core

| Belge | Açıklama |
|-------|----------|
| [architecture.md](./architecture.md) | Sistem mimarisi, veri akışları, mermaid diyagramları |
| [core-components.md](./core-components.md) | Core modül referansı (plugins, tool-registry, auth, policy, audit) |
| [mcp-integration.md](./mcp-integration.md) | MCP STDIO/HTTP entegrasyonu, Cursor/Claude kurulumu |

## Güvenlik ve Kimlik Doğrulama

| Belge | Açıklama |
|-------|----------|
| [security.md](./security.md) | Dört katmanlı güvenlik modeli, sandbox, policy |
| [authentication.md](./authentication.md) | REST vs MCP auth, scope, OAuth |

> **Önemli:** REST auth (`HUB_*_KEY`) ile MCP auth (`HUB_AUTH_ENABLED`) birbirinden bağımsızdır. STDIO giriş noktası `bin/mcp-hub-stdio.js` dosyasıdır.

## Plugin'ler

| Belge | Açıklama |
|-------|----------|
| [plugins/overview.md](./plugins/overview.md) | Tüm 35 plugin — amaç, MCP tool sayısı, env, risk, durum |
| [plugins/core-20.md](./plugins/core-20.md) | PLAN-V2 çekirdek 20 plugin katman mimarisi |
| [plugins/development.md](./plugins/development.md) | Plugin geliştirme rehberi |

Teknik referans: [`mcp-server/docs/plugin-development.md`](../mcp-server/docs/plugin-development.md)

## Operasyonlar

| Belge | Açıklama |
|-------|----------|
| [operations.md](./operations.md) | Job kuyruğu, audit, observability, Redis, testler |
| [observability.md](./observability.md) | Metrik ve monitoring |
| [jobs.md](./jobs.md) | Asenkron job API |
| [tenancy.md](./tenancy.md) | Multi-tenant yapılandırma |

## Yol Haritası

### Kesin Yürütme Sırası (Canonical)

| Belge | Açıklama |
|-------|----------|
| [**roadmap/EXECUTION-ORDER.md**](./roadmap/EXECUTION-ORDER.md) | **Tek kaynak** — Faz 0→6H sırası, gate'ler, manuel test, out-of-scope |

> Faz atlama yok. Bir faz %100 tamamlanmadan sonraki faza geçilmez. Detaylı görevler faz belgelerindedir; sıra ve kabul EXECUTION-ORDER'da tanımlıdır.

### Step 2 — Sıralı Geliştirme Planı (Aktif)

| Belge | Açıklama |
|-------|----------|
| [roadmap/step2-master-plan.md](./roadmap/step2-master-plan.md) | Master plan, faz diyagramı, ilkeler (sıra için EXECUTION-ORDER'a bakın) |
| [roadmap/step2-phase-01-web-ui.md](./roadmap/step2-phase-01-web-ui.md) | Faz 1 — Web UI + LLM bağlantısı |
| [roadmap/step2-phase-02-mssql.md](./roadmap/step2-phase-02-mssql.md) | Faz 2 — MSSQL persistence |
| [roadmap/step2-phase-03-obsidian.md](./roadmap/step2-phase-03-obsidian.md) | Faz 3 — Obsidian bellek export |
| [roadmap/step2-phase-04-dynamic-env.md](./roadmap/step2-phase-04-dynamic-env.md) | Faz 4 — Dynamic .env UI |
| [roadmap/step2-phase-05-tests-cleanup.md](./roadmap/step2-phase-05-tests-cleanup.md) | Faz 5 — Test temizliği (manuel odak) |
| [roadmap/step2-future-backlog.md](./roadmap/step2-future-backlog.md) | Faz 5 sonrası backlog (Telegram, voice, vb.) |

> **Kural:** Faz N kabul kriterleri tamamlanmadan Faz N+1 başlamaz. Sıra ve gate tanımları: [EXECUTION-ORDER.md](./roadmap/EXECUTION-ORDER.md).

### Platform Durumu ve Geçmiş Planlar

| Belge | Açıklama |
|-------|----------|
| [roadmap/current-state.md](./roadmap/current-state.md) | Güncel platform durumu ve metrikler |
| [roadmap/phase3-summary.md](./roadmap/phase3-summary.md) | Phase 3 — Premium AI Agent Platform |
| [roadmap/technical-debt.md](./roadmap/technical-debt.md) | Bilinen teknik borçlar |
| [roadmap/future-directions.md](./roadmap/future-directions.md) | Phase 4+ gelecek yönler (referans) |

Plan belgeleri: [`PLAN-V2.md`](../PLAN-V2.md), [`PLAN-V3.md`](../PLAN-V3.md)

## MCP İstemci Kurulumu

| Belge | Konum |
|-------|-------|
| Cursor | [`mcp-server/docs/cursor-setup.md`](../mcp-server/docs/cursor-setup.md) |
| Claude Desktop | [`mcp-server/docs/integrations/claude-desktop.md`](../mcp-server/docs/integrations/claude-desktop.md) |
| MCP Client Config | [`mcp-server/docs/mcp-client-config.md`](../mcp-server/docs/mcp-client-config.md) |

## Platform Metrikleri (Özet)

| Metrik | Değer |
|--------|-------|
| Plugin sayısı | 35 |
| Çekirdek plugin (PLAN-V2) | 20 |
| MCP tool | ~177 |
| Test durumu | ~664 / 778 geçiyor |
| Node.js | >= 18 |
| Varsayılan port | 8787 |

## Dizin Yapısı

```
docs/
├── README.md                 ← Bu dosya
├── architecture.md           ← Sistem mimarisi
├── core-components.md        ← Core modül referansı
├── security.md               ← Güvenlik modeli
├── authentication.md         ← Auth rehberi
├── mcp-integration.md        ← MCP entegrasyonu
├── getting-started.md        ← Başlangıç kılavuzu
├── configuration.md          ← Env değişkenleri
├── api-reference.md          ← REST API
├── operations.md             ← Operasyonel rehber
├── plugins/
│   ├── overview.md           ← 35 plugin referansı
│   ├── core-20.md            ← Çekirdek 20 plugin
│   └── development.md        ← Plugin geliştirme
└── roadmap/
    ├── EXECUTION-ORDER.md         ← Canonical yürütme sırası (tek kaynak)
    ├── step2-master-plan.md       ← Step 2 master plan
    ├── step2-phase-01-web-ui.md   ← Faz 1: Web UI + LLM
    ├── step2-phase-02-mssql.md    ← Faz 2: MSSQL
    ├── step2-phase-03-obsidian.md ← Faz 3: Obsidian
    ├── step2-phase-04-dynamic-env.md ← Faz 4: Dynamic env
    ├── step2-phase-05-tests-cleanup.md ← Faz 5: Tests
    ├── step2-future-backlog.md    ← Step 2 sonrası
    ├── current-state.md           ← Güncel durum
    ├── phase3-summary.md          ← Phase 3 özeti
    ├── technical-debt.md          ← Teknik borç
    └── future-directions.md       ← Gelecek yönler (referans)
```

## Katkıda Bulunma

Dokümantasyon güncellemeleri için [`CONTRIBUTING.md`](../CONTRIBUTING.md) dosyasına bakın. Plugin geliştirme standartları [`PLAN-V2.md`](../PLAN-V2.md) standardizasyon kontrol listesinde tanımlıdır.
