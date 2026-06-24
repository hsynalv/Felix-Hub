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

**Exit gate:**
- [ ] Tek tool registry + tek audit write path kararı uygulandı
- [ ] REST + MCP auth modeli birleşik
- [ ] `npm run test:run` + `validate:plugins` CI'da yeşil
- [ ] Rate limit / bind / CORS production profili dokümante + uygulandı

---

## Faz 1 — Çekirdek ürün (agent execution)

**Hedef:** "Bu agent ne yaptı?" sorusuna ürün seviyesinde cevap.

| Sıra | Pillar | Süre | Not |
|------|--------|------|-----|
| 1.1 | [01-agent-runtime-workflow.md](./01-agent-runtime-workflow.md) — Faz A | 2 hafta | Run modeli + persistence |
| 1.2 | [02-policy-approval-center.md](./02-policy-approval-center.md) — Faz A | 1 hafta | Mevcut policy'yi run'a bağla |
| 1.3 | [04-visual-run-dashboard.md](./04-visual-run-dashboard.md) — Faz A | 2 hafta | Timeline MVP |
| 1.4 | [01-agent-runtime-workflow.md](./01-agent-runtime-workflow.md) — Faz B | 2 hafta | Job resume, replay |

**Exit gate:**
- [ ] Tek agent run uçtan uca: plan → tool calls → onay → sonuç
- [ ] Run listesi + detay timeline UI'da
- [ ] Approval queue Admin'den yönetilebilir
- [ ] Örnek senaryo: "repo analiz → issue → branch → PR" tek `run_id` altında izlenebilir

---

## Faz 2 — Zeka ve maliyet

| Sıra | Pillar | Süre |
|------|--------|------|
| 2.1 | [03-project-workspace-intelligence.md](./03-project-workspace-intelligence.md) — Faz A | 3 hafta |
| 2.2 | [06-usage-cost-quota.md](./06-usage-cost-quota.md) — Faz A–B | 2 hafta |
| 2.3 | [04-visual-run-dashboard.md](./04-visual-run-dashboard.md) — Faz B | 1 hafta |

**Exit gate:**
- [ ] Proje seçildiğinde context graph sorgulanabilir
- [ ] Run başına maliyet görünür; proje bazlı quota uyarısı çalışır

---

## Faz 3 — Ekosistem ve kalite

| Sıra | Pillar | Süre |
|------|--------|------|
| 3.1 | [08-secrets-env-management.md](./08-secrets-env-management.md) | 2 hafta |
| 3.2 | [05-connector-marketplace.md](./05-connector-marketplace.md) | 2 hafta |
| 3.3 | [07-eval-regression.md](./07-eval-regression.md) — Faz A | 2 hafta |

**Exit gate:**
- [ ] Plugin enable/disable + connection test wizard
- [ ] En az 1 golden agent trace regression CI'da

---

## Faz 4 — Uzantı

| Sıra | Pillar | Süre |
|------|--------|------|
| 4.1 | [09-local-sidecar-desktop-agent.md](./09-local-sidecar-desktop-agent.md) | 3+ hafta |
| 4.2 | [03-project-workspace-intelligence.md](./03-project-workspace-intelligence.md) — Faz B | sürekli |

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
| `v3.0-beta` | Faz 1 exit (run + approval + timeline) |
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
