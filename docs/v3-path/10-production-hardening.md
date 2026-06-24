# 10 — Production Hardening

> **Status:** in_progress (kısmen)  
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

- [ ] `job.manager.js` canonical
- [ ] Agent long-run (Pillar 01) bu kaynağı kullanır
- [ ] Admin UI tek jobs API

### Audit birleştirme

- [ ] `audit.service.js` — tüm mutasyonlar
- [ ] REST + MCP + tool call → aynı schema
- [ ] `AuditPage` tek sorgu kaynağı

### Auth modeli

- [ ] REST: Bearer / API key scopes
- [ ] MCP: aynı scope seti
- [ ] `requireScope("admin")` tutarlı
- [ ] Dokümantasyon: `docs/security.md` güncelle

### Production profili

Env flag: `NODE_ENV=production` veya `MCP_HUB_PROFILE=production`

| Ayar | Production |
|------|------------|
| CORS | Explicit origin list |
| Bind | `0.0.0.0` yerine internal |
| Rate limit | Per API key |
| Error detail | Generic client message |
| STRICT_PLUGIN_LOADING | true |

### Plugin permission manifest

`plugin.meta.json` zorunlu alanlar:

```json
{
  "security": {
    "riskLevel": "low|medium|high|destructive",
    "capabilities": ["read", "write", "network", "shell"],
    "requiresApproval": ["write", "destructive"]
  }
}
```

`validate:plugins` — eksik → CI fail.

### Structured logs

- [ ] Pino veya benzeri JSON logger
- [ ] `request_id`, `run_id`, `plugin`, `tool` alanları
- [ ] Log level env

### OpenTelemetry

- [ ] HTTP span
- [ ] Tool call span (child)
- [ ] Export: OTLP endpoint env

### CI pipeline

| Job | Tetik |
|-----|-------|
| `validate:plugins` | Her PR |
| `test:run` | Her PR |
| `test:integration` | Nightly + release |
| Eval smoke (Pillar 07) | Nightly |

`.github/workflows/integration.yml` — tamamla/aktifleştir.

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
