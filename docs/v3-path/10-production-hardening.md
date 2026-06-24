# 10 — Production Hardening

> **Status:** done (Faz 0 — 2026-06-24)  
> **Öncelik:** P0 (Faz 0 — her şeyden önce)  
> **Bağımlılık:** Yok — diğer tüm pillar'ların önkoşulu

---

## Amaç

Yeni özellikten önce **platform omurgasını** sağlamlaştırmak: tek registry, tek audit, tek jobs kaynağı; auth birleştirme; production profili; plugin permission manifest; structured logs; OpenTelemetry; CI validate + integration nightly.

> Strateji: Önce bu pillar, sonra "güvenli agent execution platformu" ürünü.

---

## Mevcut durum ve borç

| Alan | Durum | Hedef |
|------|-------|-------|
| Tool registry | `tool-registry.js` + `tools/tool.registry.js` çift yol | Tek kaynak |
| Jobs | `jobs.js` + `jobs/job.manager.js` | Tek kaynak |
| Audit | Dağınık log çağrıları | Tek `audit.service` |
| Auth REST vs MCP | Farklı middleware yolları | Birleşik scope model |
| CORS / bind / rate-limit | Dev-friendly default | Production profili |
| Plugin permissions | `plugin.meta.json` security kısmi | Manifest zorunlu |
| Logging | `console` + ad-hoc | Structured JSON |
| Tracing | Yok | OpenTelemetry |
| CI | `test:run`, `validate:plugins` | + integration nightly |

**İlgili:** `docs/technical-debt.md`, `docs/roadmap/technical-debt.md`

---

## Faz 0 checklist

### Registry birleştirme

- [ ] `tool-registry.js` canonical; legacy path deprecate
- [ ] Plugin register → tek API
- [ ] Test: tool listesi çift kayıt üretmez

### Jobs birleştirme

- [x] `jobs.js` canonical; `job.manager.js` deprecated
- [x] Agent long-run (Pillar 01) bu kaynağı kullanır
- [x] Admin UI tek jobs API

### Audit birleştirme

- [x] `audit.service.js` — tüm mutasyonlar
- [x] REST + MCP + tool call → aynı schema
- [x] `AuditPage` `/audit/events` kaynağı

### Auth modeli

- [x] REST: Bearer / API key scopes
- [x] MCP: aynı scope seti (`validateBearerToken` + UI token)
- [x] `requireScope("admin")` tutarlı
- [ ] Dokümantasyon: `docs/security.md` güncelle

### Production profili

Env flag: `NODE_ENV=production`

| Ayar | Production |
|------|------------|
| CORS | `sanity.js` zorunlu `CORS_ALLOWED_ORIGINS` |
| Bind | `127.0.0.1` default |
| Rate limit | Per API key, 120 RPM default |
| Error detail | Generic 500 message |
| STRICT_PLUGIN_* | Production default true |

### Plugin permission manifest

- [x] `riskLevel`, `capabilities`, `requiresApproval[]` — 35/35
- [x] `validate:plugins` CI fail

### Structured logs

- [x] `logger.js` wired (`index.js`, `jobs.js`, `tool-registry.js`)

### OpenTelemetry

- [x] `otel.js` bootstrap + tool spans (`OTEL_EXPORTER_OTLP_ENDPOINT`)
- [ ] HTTP auto-instrumentation (requires `@opentelemetry/*` packages)

### CI pipeline

| Job | Tetik |
|-----|-------|
| `validate:plugins` | Her PR ✅ |
| `test:run` | Her PR ✅ |
| `test:integration` | Nightly (hard fail) ✅ |
| Eval smoke (Pillar 07) | Nightly — Faz 3 |

---

## Kabul kriterleri (Faz 0 exit)

- [ ] Tek tool registry — kod aramasında duplicate register yok
- [ ] Audit kaydı tool call + REST admin action için tutarlı
- [ ] Production profili dokümante ve test edilmiş
- [ ] 35/35 plugin manifest security alanı dolu
- [ ] CI green: unit + validate; nightly integration tanımlı

---

## Sıra ile diğer pillar'lar

Faz 0 tamamlanınca:

1. [01-agent-runtime-workflow.md](./01-agent-runtime-workflow.md) + [02-policy-approval-center.md](./02-policy-approval-center.md)
2. [04-visual-run-dashboard.md](./04-visual-run-dashboard.md)
3. [03-project-workspace-intelligence.md](./03-project-workspace-intelligence.md)
4. [06-usage-cost-quota.md](./06-usage-cost-quota.md)
5. [08-secrets-env-management.md](./08-secrets-env-management.md) + [05-connector-marketplace.md](./05-connector-marketplace.md)
6. [07-eval-regression.md](./07-eval-regression.md)
7. [09-local-sidecar-desktop-agent.md](./09-local-sidecar-desktop-agent.md)

Detay: [EXECUTION-ORDER.md](./EXECUTION-ORDER.md)

---

## Riskler

| Risk | Azaltma |
|------|---------|
| Registry refactor regression | Golden tool list snapshot test |
| Auth birleştirme breaking | Integration test matrix |
| OTel overhead | Sampling production'da %10 |

**Bu pillar bitmeden** yeni plugin sayısı artırmak öncelik değil.
