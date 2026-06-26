# V6 MVP Notları

> **Son güncelleme:** 2026-06-26

Bu dosya Faz A'da bilerek ertelenen maddeleri ve sonraki fazların kapsamını takip eder.

---

## Faz A — `mvp_done` ama tam ürün değil

| Pillar | Yapıldı (MVP) | Ertelendi |
|--------|---------------|-----------|
| **6.1 Multi-Agent** | `metadata.parentRunId`, roller, parent/spawn/aggregate API | Workflow executor'da `type: "agent"` adımı; child tamamlanana kadar bekleme; handoff branch/merge; MSSQL `parent_run_id` kolonu |
| **6.2 Skill Store** | JSON store, 3 builtin skill, compile + dry-run run | Skill marketplace paylaşımı; versiyon semver; skill imzalama; chat tool (`agent_skill_*`) |
| **6.3 Watchers** | CRUD, test-fire, dispatch, observability webhook köprüsü | Dedup fingerprint; rate limit per source; watcher→inbox bildirim; karmaşık event filter DSL |
| **6.4 Sandbox** | Oturum CRUD, `context.sandboxId` mock hook | Fixture replay; partial mock matrix; sandbox UI'dan tool trace drill-down |
| **6.5 Trust Score** | Run geçmişinden skor + cache, watcher `minTrustScore` gate | Per-role/per-user trust; decay window; otomatik recalculate cron |

### Faz C — henüz başlanmadı

| Pillar | Kısa açıklama |
|--------|----------------|
| **6.8 Agent App Store** | Skill/runbook paketleri, kurulum, rating |
| **6.9 Enterprise Compliance Pack** | Audit export, retention policy, SOX-style checklist |
| **6.10 Natural Language Admin** | Sohbetten hub yönetimi |
| **6.11 Knowledge Conflict Resolver** | Brain/RAG çakışma tespiti ve merge |
| **6.12 Personal Operating Model** | Kullanıcıya özel agent profili ve tercihler |

### V5'ten devreden açık borçlar (V6 dışı)

- JSON store → MSSQL migration (schedules, skills, watchers, sandbox, trust)
- SLA trend grafikleri (zaman serisi UI)
- Tam Notion ↔ Obsidian sync
- Harici CI/CD deploy hook (promotion execute sonrası)

---

## Faz B — hedef (`v6.1` milestone)

| Pillar | MVP hedefi |
|--------|------------|
| **6.6 Agent Inbox** | Onay + failed run + SLA + watcher olaylarını tek feed'de; read/snooze; minimal UI |
| **6.7 Observability Pro** | Agent-centric dashboard: failure hotspots, approval bottleneck, cost, reliability trend |

---

## API özeti (Faz A)

```
GET  /multi-agent/roles
POST /multi-agent/parents
POST /multi-agent/parents/:id/spawn
GET  /multi-agent/parents/:id/aggregate

GET|POST|PUT|DELETE /skills
POST /skills/:id/compile
POST /skills/:id/run

GET|POST|PUT|DELETE /watchers
POST /watchers/:id/test-fire
POST /watchers/dispatch

GET|POST /sandbox/sessions
POST /sandbox/sessions/:id/close

GET  /trust/scores
POST /trust/recalculate
```

UI: `http://localhost:5173/v6`

---

## Faz B — `mvp_done` (2026-06-26)

| Pillar | Yapıldı | Ertelendi |
|--------|---------|-----------|
| **6.6 Inbox** | Unified feed (approval, run, SLA, watcher), read/snooze, `/inbox` UI, SSE endpoint | Approval Pro tam migrate; bulk action; desktop push; inbox→action deep link |
| **6.7 Obs Pro** | `/observability-pro/dashboard`, Observability sayfasında Agent Pro paneli | Grafana export; prompt drift; tool-call graph viz; alert rules engine |

### Faz B API

```
GET  /inbox/items
GET  /inbox/summary
POST /inbox/items/:id/read
POST /inbox/items/:id/snooze
GET  /inbox/stream          (SSE)

GET  /observability-pro/dashboard?days=7
```

UI: `http://localhost:5173/inbox` · Observability → Agent Pro paneli

---

## Faz C — `mvp_done` (2026-06-26)

| Pillar | Yapıldı | Ertelendi |
|--------|---------|-----------|
| **6.8 App Store** | 5 builtin agent ürünü, install/uninstall wizard, trust+cost badge | Harici mağaza, rating, semver upgrade path |
| **6.9 Compliance** | Policy store, audit export JSON/CSV, admin report, PII redaction | SSO/OIDC, SCIM, legal hold UI, per-tenant keys |
| **6.10 NL Admin** | Intent parser, preview, execute + audit | Chat-native flow, geniş intent kataloğu |
| **6.11 Conflicts** | Topic scan, auth stance heuristic, resolve + inbox hook | Semantic RAG compare, `project_resolve_conflict` tool |
| **6.12 Operating Model** | remember/forget/pin, export, chat prompt injection | GDPR import UI, conflict cross-check |

### Faz C API

```
GET  /app-store/products
POST /app-store/products/:id/install|uninstall

GET|PUT /compliance/policy
GET /compliance/report
GET /compliance/audit/export

POST /nl-admin/parse|execute

POST /conflicts/detect
POST /conflicts/:id/resolve

GET|POST|DELETE /operating-model/*
```

UI: `http://localhost:5173/v6` (App Store, NL Admin, Compliance, Conflicts, Profil sekmeleri)

