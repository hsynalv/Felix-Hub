# V5 Hardening Notes

> **Son güncelleme:** 2026-06-26  
> V5 pillar'ları **MVP omurga** olarak tamamlandı; aşağıdaki maddeler bilinçli teknik borç veya kısmi kapsamdır.

## Kapatılan riskler (2026-06-26)

| Risk | Çözüm |
|------|--------|
| `force: true` ile preflight/approval bypass (write scope) | `runbook-force-guard.js` — yalnızca **admin** scope veya `forceInternal` (scheduler) |
| L4/L5 schedule SLA zorunluluğu yok | `schedule-policy.js` — create/update sırasında SLA + L5 prod `maxCostUsd` kontrolü |
| Incident triage yalnızca simulated spike | `observability-signal.js` — audit error log + **webhook store** (Sentry/Datadog/generic) |
| SLA yalnızca violation listesi | `GET /sla/dashboard` + **Ops UI dashboard** (7d, byRule, MTTR) |
| Briefing dosya export yok | `export.md` / `export.html` / `export.pdf` + UI indirme |
| Maintenance cargo/go docs vs kod | `go list -m -u` + `cargo outdated` scan paths |
| Autonomy yalnızca runbook/schedule preflight | `autonomy-hook.js` — her `callTool()` L0–L5 gate |
| L4/L5 runtime SLA yok | `workflow-sla-gate.js` — her workflow tool step sonrası re-check |
| Hygiene drift / secrets yok | `detectKnowledgeDrift` + `detectUnusedIntegrationSecrets` |
| Desktop OCR guard eksik | `DESKTOP_OCR_REQUIRED=true` → screenshot + OCR sensitive block |
| Env promotion execute UI yok | Promotion list / approve / execute Ops sekmesi |
| PDF export yok | Minimal PDF generator (`briefing-export.js`) |

## Açık kalan maddeler (partial / V6+)

| Alan | Durum | Not |
|------|--------|-----|
| SLA trend grafikleri | partial | Dashboard metrikleri var; zaman serisi chart yok |
| Observability | partial | Webhook ingest var; gerçek Sentry/Datadog imza doğrulama opsiyonel |
| Notion/Obsidian drift | partial | Heuristic reachability; tam iki-yönlü sync karşılaştırması yok |
| Unused secrets | partial | Audit heuristic; gerçek secret scanner değil |
| Desktop/IDE security | partial | OCR preflight + allowlist; L4 preview UI + L5 recording yok |
| Env promotion execute | partial | Config merge + pipeline checklist; harici CI/CD hook V6 |
| JSON file stores | known debt | MSSQL migration V6+ persistence path |

## Store persistence

Runbook, schedule, SLA, briefing, env registry → `cache/*.json`. Production managed ops için:

- Row-level locking / optimistic concurrency
- MSSQL tabloları (`runbooks`, `agent_schedules`, `sla_violations`, `briefings`, `env_promotions`)
- Audit trail zaten memory + optional persistence

## Force execution policy

```text
POST .../execute { force: true }
  → 403 force_forbidden (write scope)
  → 200/201 (admin scope)

Internal: executeRunbook({ forceInternal: true }) — scheduler/test harness only
```

## Observability webhooks

```text
POST /integrations/observability/sentry     (SENTRY_WEBHOOK_SECRET)
POST /integrations/observability/datadog  (DATADOG_WEBHOOK_SECRET)
POST /integrations/observability/generic    (write scope)
GET  /integrations/observability/signals
```

## Docs doğruluğu

Pillar dosyalarında `[ ]` ile işaretli maddeler **bilinçli partial/not_started** kapsamıdır. EXECUTION-ORDER `done` = omurga MVP tamam, tüm alt maddeler değil.
