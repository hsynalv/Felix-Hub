# V8 — Remaining Work (post-MVP)

> **Son güncelleme:** 2026-06-26  
> **Bağlam:** [EXECUTION-ORDER.md](./EXECUTION-ORDER.md) Faz A–C **done (MVP)** — exit gate’ler karşılandı; bu dosya tam ürünleştirme ve production sertleştirme backlog’u.

**Semantik:** `Status: done (MVP)` = pillar’ın çekirdek kodu ve smoke testleri var; alt deliverable’ların tamamı bitmiş değil. V5/V6 ile aynı model.

---

## 1. Dokümantasyon

| Madde | Durum |
|-------|--------|
| Pillar dosyalarında `Status: done (MVP)` + exit checkbox’ları | synced |
| Bu dosya (honest backlog) | bu dosya |
| Cross-version persistence / observability notları | §2, §8 |

---

## 2. Persistence (V6/V7/V8 ortak)

| Alan | Mevcut | Hedef |
|------|--------|-------|
| Prompt registry | `cache/prompts.json` + mutex | MSSQL tablo + migration |
| Spec sessions | `cache/spec-sessions/*.json` | MSSQL + project binding |
| Import drafts | `cache/prompt-intelligence/drafts/` | MSSQL veya blob store |
| Eval sonuçları | in-memory / ephemeral | retention policy + export |
| File lock / transaction | promise mutex (prompt store) | distributed lock (multi-instance) |

---

## 3. Prompt eval — gerçek regresyon

| Madde | MVP | Eksik |
|-------|-----|-------|
| Heuristic smoke (`eval:prompt`) | ✓ | — |
| Golden conversation suite | — | `tests/eval/conversations/*.json` |
| LLM-as-judge / tool-choice regression | — | `eval:prompt:llm` + `OPENAI_API_KEY` gate |
| CI gate (PR block) | — | workflow: `npm run eval:prompt` + optional LLM job |

---

## 4. Spec workflow — production polish

| Madde | MVP | Eksik |
|-------|-----|-------|
| Session API + artifact edit | ✓ | — |
| Chat SpecArtifactPanel | ✓ | — |
| Artifact version history | — | append-only revisions |
| Diff / approval gate | — | UI + API |
| Project / repo binding | — | `projectId` on session |
| Task runner entegrasyonu | kısmi | spec tasks → `agent_run` batch |

---

## 5. Importer & marketplace

| Madde | MVP | Eksik |
|-------|-----|-------|
| CLI + draft JSON | ✓ | — |
| Settings approval queue | ✓ | — |
| Test izolasyonu (`CATALOG_CACHE_DIR`) | ✓ | `tests/helpers/temp-cache-env.js` |
| Vendor-neutral overlay metinleri | ✓ | `Focused Coder`, `Spec Planner` |
| GPL / provenance review automation | — | importer risk skoru → block |

---

## 6. Tool calling & schema

| Madde | Durum |
|-------|--------|
| `ensureWriteToolExplanation` at registration | `registerTool` |
| `STRICT_TOOL_SCHEMA` CI | `npm run validate:tools` |
| Plugin kaynaklarında native `explanation` | kademeli — uyarılar azalır |

---

## 7. V7 kişisel asistan (paralel track)

Token encryption, retry/backoff, dedup kalitesi, source health alert, Telegram file/photo/inline approval → [v7-path REMAINING-WORK](../v7-path/REMAINING-WORK.md) (oluşturulacak veya mevcut pillar notları).

---

## 8. Desktop / IDE & observability (ileri faz)

| Alan | Eksik |
|------|--------|
| Desktop | mTLS/pairing, allowlist, screenshot redaction, replay audit, offline sidecar |
| Observability | Sentry/Datadog/Grafana, SLA trend, alert rules, compliance export, SSO/SCIM |

---

## Öncelik önerisi

1. **P0:** Test izolasyonu, marketplace nötr isimler, doc status sync (bu PR)
2. **P1:** Golden conversation eval + CI `eval:prompt`
3. **P2:** Spec artifact history + project binding
4. **P3:** MSSQL migration plan (V6/V7/V8 store envanteri)
