# 06 — Usage, Cost ve Quota

> **Status:** not_started  
> **Öncelik:** P1 (Faz 2)  
> **Bağımlılık:** [01-agent-runtime-workflow.md](./01-agent-runtime-workflow.md) (`run_id` join)

---

## Amaç

LLM/router ve usage ledger'ı **ürün seviyesinde maliyet yönetimine** dönüştürmek: provider/plugin/proje bazlı maliyet, quota, budget guardrail, "bu agent run kaç dolar tuttu?"

---

## Mevcut durum

| Var | Eksik |
|-----|-------|
| `usage-ledger.service.js` | `run_id` foreign key |
| `003_llm_usage.sql` migration | Quota tablosu |
| `usage-pricing.js` — estimate | Gerçek invoice reconcile |
| `UsagePage` — özet | Run detail cost |
| Chat bubble token gösterimi | Budget alert |

**İlgili:** `mcp-server/src/core/usage/`, `mcp-server/frontend/src/pages/UsagePage.tsx`

---

## Veri modeli genişlemesi

### `usage_events` (mevcut + alanlar)

| Yeni alan | Açıklama |
|-----------|----------|
| `run_id` | Agent run FK |
| `project_id` | Quota scope |
| `step_id` | Run step |

### `usage_quotas` (yeni)

| Alan | Açıklama |
|------|----------|
| `scope_type` | `global`, `project`, `user`, `api_key` |
| `scope_id` | |
| `period` | `daily`, `monthly` |
| `limit_tokens` | |
| `limit_usd` | |
| `alert_threshold` | 0.8 = %80 uyarı |

### `usage_budgets`

Hard stop vs soft alert ayrımı.

---

## Fiyatlandırma

Mevcut `estimateImageCostUsd`, chat token pricing — genişlet:

| Kaynak | Metrik |
|--------|--------|
| OpenAI chat | prompt/completion tokens |
| DALL-E | image size/quality |
| Video-gen | süre/model (tahmini) |
| Embedding (RAG) | token |

Provider fiyat tablosu `usage-pricing.js` — versiyonlu (tarih effective).

---

## Guardrail davranışı

| Eşik | Davranış |
|------|----------|
| %80 quota | UI warning + webhook (notifications plugin) |
| %100 soft | Run başlatma uyarı, devam admin onayı |
| %100 hard | Yeni run/chat LLM çağrısı blok |

Policy engine ile entegre: `budget_exceeded` → deny.

---

## UI

| Görünüm | İçerik |
|---------|--------|
| UsagePage | Mevcut + project/run filtre |
| Run detail | Step cost waterfall |
| Settings | Quota config (admin) |
| Chat | Run toplam maliyet footer |

---

## Uygulama fazları

### Faz A — Run + project attribution (1 hafta)

- [ ] `recordUsageEvent` — `run_id`, `project_id`
- [ ] `GET /usage/runs/:id`
- [ ] `GET /usage/projects/:id`

### Faz B — Quota engine (1 hafta)

- [ ] `checkQuota(scope)` — orchestrator başında
- [ ] MSSQL `usage_quotas`
- [ ] Admin UI quota form

### Faz C — Budget guardrail (1 hafta)

- [ ] Hard/soft mod env veya quota flag
- [ ] Telegram/email alert (notifications)

### Faz D — Raporlama (1 hafta)

- [ ] CSV export
- [ ] Provider karşılaştırma (aynı görev farklı model)

---

## Exit criteria

- [ ] Her tamamlanan run'da `estimatedCostUsd` toplamı
- [ ] Proje quota aşımında yeni LLM çağrısı engellenir veya uyarır
- [ ] UsagePage run_id ile filtrelenebilir

**Sonraki:** [04-visual-run-dashboard.md](./04-visual-run-dashboard.md) Faz D
