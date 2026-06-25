# V3 Execution Order

> **Son güncelleme:** 2026-06-25  
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

## Faz 1 — Çekirdek ürün (agent execution) — **v1 done** ✅

> **Not:** Run entity, step trace, dry replay ve linear workflow template MVP tamamlandı. Conditional steps, durable resume, rollback ve formal state machine **Faz 5 / v2** kapsamındadır.

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

## Faz 5 — Ürünleştirme + Runtime v2 (v3.4) — **done** ✅

**Hedef:** MVP'leri günlük kullanım ve gerçek workflow engine seviyesine taşımak. Faz 1 agent runtime = **v1 done**; bu faz **v2** kapsar.

| Sıra | Pillar / Sprint | Durum |
|------|-----------------|-------|
| 5.1 | Runs UI ürünleştirme (template form, SSE, approval/resume) | done |
| 5.2 | [01-agent-runtime-workflow.md](./01-agent-runtime-workflow.md) v2 (conditional, checkpoint resume, rollback) | done |
| 5.3 | [03-project-workspace-intelligence.md](./03-project-workspace-intelligence.md) Faz D (graph edges, goal retrieval) | done |
| 5.4 | Platform hijyeni (test bootstrap, tool tags strict, audit correlationId) | done |

**Exit gate:**
- [x] Workflow template dialog (validation, dry-run, repo preset)
- [x] Live SSE run view + approval/resume/retry UI
- [x] Runtime v2: conditional step + durable checkpoint resume + compensate hook
- [x] Context graph edges + `project_context_for_goal`
- [x] `jobs-api.test.js` < 10s; tool tag warnings sıfır

> **Milestone:** `v3.4-beta` = Sprint A exit; `v3.5` = Runtime v2 exit

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
| `v3.4-beta` | Faz 5 Sprint A (Runs UI product) |
| `v3.5` | Faz 5 Sprint B (Runtime v2 engine) |

---

## İzleme

Her pillar dosyasında:

```markdown
Status: not_started | in_progress | done
Owner: —
Last reviewed: YYYY-MM-DD
```

Sprint planlarken `docs/priorities.md` ile çakışan maddeleri **önce Pillar 10** altında kapat, sonra V3 özelliklerine geç.

---

## V4 — Sonraki yol

V3 Faz 5 (v3.4) tamamlandıktan sonra ürün yönü [V4 path](../v4-path/README.md) ile devam eder:

- **Kısa vade:** Platform core → Runtime v2 → Run Designer → Approval Pro
- **Orta vade:** Project Command Center → Desktop Control → Self-Healing Dev
- **Uzun vade:** Eval Studio → Cost guardrails → Team packs

Detay: [v4-path/EXECUTION-ORDER.md](../v4-path/EXECUTION-ORDER.md)

---

## Faz 6 — Kalan işler (v3.6) — **in progress**

> **Not:** Faz 0–5 exit gate'leri **MVP seviyesinde** karşılandı. Bu faz dokümantasyon–kod hizalaması ve kalan ürün boşluklarını kapatır.

| Sprint | İçerik | Exit | Durum |
|--------|--------|------|-------|
| 6.1 | Doc sync + `REMAINING-WORK.md` | Pillar Status/checkbox hizalı | done |
| 6.2 | Checkpoint resume + workflow quota | Resume doğru adımdan; `assertRunQuota` | done |
| 6.3 | Project switcher + Notion sync + ask/impact API | Chat/Runs header; REST sorguları | done |
| 6.4 | Secrets audit + eval genişletme + step cost | Audit tablosu; 4 golden trace | done |
| 6.5 | Sidecar persist + marketplace UI + polish | `sidecar_devices`; `/approvals` nav | done |

**Exit gate (v3.6):**
- [x] `REMAINING-WORK.md` ile kod durumu senkron
- [x] Checkpoint `current_step` + resume from checkpoint payload
- [x] `ProjectSwitcher` Chat + Runs
- [x] `GET /projects/:name/ask` + `/impact`
- [x] Notion indexer dalı
- [x] Workflow quota + step maliyet tablosu
- [x] `settings_audit` migration + UI
- [x] 4 golden trace + plugin meta snapshot CI
- [x] `dangerousCombinations` enable uyarısı
- [x] Sidecar device persistence

> **Milestone:** `v3.6` — V4 Faz 1'e geçiş için hazır. Bilinçli ertelenenler: [REMAINING-WORK.md](./REMAINING-WORK.md) → v3.7 / V4.
