# V3 Execution Order

> **Son güncelleme:** 2026-06-24  
> **Kural:** Yeni pillar'a geçmeden önce bir önceki fazın **Exit criteria** tamamlanmış olmalı.

---

## Kısa strateji (önerilen sıra)

1. **Platform omurgasını sağlamlaştır** — registry, auth, audit, jobs, test (Pillar 10)
2. **Ana ürünü netleştir** — "MCP Hub" değil, **güvenli agent execution platformu**
3. **Özellikleri sırayla ekle:**
   - Agent run timeline + Approval Center (01 + 02 + 04)
   - Project memory (03)
   - Usage / cost / quota (06)
   - Marketplace + setup wizard (05 + 08)
   - Eval / regression (07)
   - Local sidecar + Obsidian derin entegrasyon (09)

---

## Faz 0 — Omurga (önce bu)

**Hedef:** Yeni özellik eklemeden güvenilir temel.

| Sıra | Pillar | Süre (tahmini) | Bağımlılık |
|------|--------|----------------|------------|
| 0.1 | [10-production-hardening.md](./10-production-hardening.md) | 2–3 hafta | — |

## Faz 0 exit gate

- [x] Tek tool registry + tek audit write path
- [x] REST + MCP auth modeli birleşik
- [x] `test:run` + `validate:plugins` CI'da yeşil
- [x] Rate limit / bind / CORS production profili

---

## Faz 1 — Çekirdek ürün (agent execution) — **done** ✅

**Hedef:** "Bu agent ne yaptı?" sorusuna ürün seviyesinde cevap.

| Sıra | Pillar | Durum |
|------|--------|-------|
| 1.1 | [01-agent-runtime-workflow.md](./01-agent-runtime-workflow.md) Faz A–D | done |
| 1.2 | [02-policy-approval-center.md](./02-policy-approval-center.md) Faz A–C | done |
| 1.3 | [04-visual-run-dashboard.md](./04-visual-run-dashboard.md) Faz A–D | done (ops overview MVP) |
| 1.4 | Agent runtime Faz B (job + SSE) | done |

**Exit gate:**
- [x] Chat tool call'ları `run_id` altında step olarak kayıt
- [x] Run listesi + detay timeline UI (`/runs`)
- [x] Approval queue Admin'de `runId` + risk
- [x] Uçtan uca onay → resume (`approval-bridge`)
- [x] Örnek repo workflow tek `run_id` (`repo-ship-feature` template)

> **Milestone:** `v3.0-beta` — Faz 1 tamamlandı, Faz 2'ye geçilebilir.

---

## Faz 2 — Zeka ve maliyet — **done** ✅

| Sıra | Pillar | Durum |
|------|--------|-------|
| 2.1 | [03-project-workspace-intelligence.md](./03-project-workspace-intelligence.md) — Faz A | done |
| 2.2 | [06-usage-cost-quota.md](./06-usage-cost-quota.md) — Faz A–B | done |
| 2.3 | [04-visual-run-dashboard.md](./04-visual-run-dashboard.md) — cost join (Faz 2) | done |

**Exit gate:**
- [x] Proje seçildiğinde context graph sorgulanabilir
- [x] Run başına maliyet görünür; proje bazlı quota uyarısı çalışır

> **Milestone:** `v3.1-beta` — Faz 2 tamamlandı, Faz 3'e geçilebilir.

---

## Faz 3 — Ekosistem ve kalite — **done** ✅

| Sıra | Pillar | Durum |
|------|--------|-------|
| 3.1 | [08-secrets-env-management.md](./08-secrets-env-management.md) Faz A–B | done (test + catalog) |
| 3.2 | [05-connector-marketplace.md](./05-connector-marketplace.md) Faz A–B | done |
| 3.3 | [07-eval-regression.md](./07-eval-regression.md) Faz A | done |

**Exit gate:**
- [x] Plugin enable/disable + connection test wizard
- [x] En az 1 golden agent trace regression CI'da (`eval:smoke`)

> **Milestone:** `v3.2-beta` — Faz 3 tamamlandı, Faz 4'e geçilebilir.

---

## Faz 4 — Uzantı — **done** ✅

| Sıra | Pillar | Durum |
|------|--------|-------|
| 4.1 | [09-local-sidecar-desktop-agent.md](./09-local-sidecar-desktop-agent.md) Faz A–E (MVP) | done |
| 4.2 | [03-project-workspace-intelligence.md](./03-project-workspace-intelligence.md) Faz B–C (MVP) | done |

**Exit gate:**
- [x] Sidecar delegation + pairing + auth token
- [x] Terminal session + desktop notify
- [x] Obsidian vault ↔ brain sync on index
- [x] [docs/sidecar.md](../sidecar.md) + `mcp-hub-sidecar` bin

> **Milestone:** `v3.3` — Faz 4 tamamlandı.

---

## Paralel çalışma kuralları

| Yapılabilir paralel | Yapılmamalı paralel |
|---------------------|---------------------|
| 04 UI + 01 backend (koordineli API) | 05 marketplace + 10 registry refactor |
| 06 usage + 04 dashboard | 01 run modeli değişirken 07 eval yazmak |
| 08 secrets UI + 05 wizard | İki farklı approval store |

---

## Milestone isimleri (release etiketleri önerisi)

| Etiket | İçerik |
|--------|--------|
| `v3.0-alpha` | Faz 0 exit |
| `v3.0-beta` | Faz 1 exit (run + approval + timeline) ✅ |
| `v3.1` | Faz 2 (project memory + cost) |
| `v3.2` | Faz 3 (marketplace + eval) |
| `v3.3` | Faz 4 (sidecar) |

---

## İzleme

Her pillar dosyasında:

```markdown
Status: not_started | in_progress | done
Owner: —
Last reviewed: YYYY-MM-DD
```

Sprint planlarken `docs/priorities.md` ile çakışan maddeleri **önce Pillar 10** altında kapat, sonra V3 özelliklerine geç.
