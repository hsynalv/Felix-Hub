# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Hardening — V5 review follow-up
- Runbook `force` bypass gated to admin scope (`runbook-force-guard.js`)
- L4/L5 schedule SLA validation on create (`schedule-policy.js`)
- Incident triage observability signal from audit errors (`observability-signal.js`)
- SLA dashboard API (`GET /sla/dashboard`)
- Briefing markdown export (`GET /reports/briefings/:id/export.md`)
- Maintenance ecosystem detection (npm/cargo/go markers)
- `docs/v5-path/HARDENING-NOTES.md` — honest partial vs done tracker

### Added — V5 Faz C (`v5.1`)
- Agent Reports & Briefings: template engine, inbox store, `/reports/*`, daily schedule preset, channel delivery
- SLA & Escalation: policies, 5m evaluator, approval timeout + failure streak pause, violation log
- Incident Triage Agent: timeline, suspected causes, postmortem draft, `/agents/incident/*`
- Environment Promotion: registry, masked config diff, approval chain, staging→prod workflow
- Ops UI tabs: Briefings, SLA, Promotion + incident triage
- Tests: `tests/core/faz-c-v5.test.js`

### Added — V5 Faz B (`v5.0-beta`)
- Release Manager: changelog/semver/migration risk analysis, draft GitHub release API (`/agents/release/*`)
- Maintenance Agent: npm outdated + audit scan, risk scoring, update PR proposal (`/agents/maintenance/*`)
- Workspace Hygiene: stale PR/TODO/failed run report, destructive cleanup approval (`/agents/hygiene/*`)
- Workflow templates: `release-manager`, `dependency-maintenance`, `workspace-hygiene`
- Runbooks: `rb-release-manager`, `rb-maintenance`, `rb-hygiene` + schedule presets
- Ops UI **Agents** tab + preset schedule creation
- Tests: `tests/core/faz-b-v5.test.js`

### Added — V5 Faz A (`v5.0-alpha`)
- Runbook automation: builtin + custom runbooks (`/ops/runbooks`), preflight, execute, post-run reports, execution audit
- Scheduled agent operations: cron schedules (`/ops/schedules`), 60s scheduler tick, skip conditions, cost max, test-fire
- Managed autonomy policies: L0–L5 levels (`/ops/autonomy`), tool/run spawn enforcement, audit trail
- Ops UI at `/ops` — runbook catalog, schedule management, autonomy matrix
- Tests: `tests/core/faz-a-v5.test.js`

### Fixed — V4 hardening
- Removed dead `buildPlanFromTemplate` call in `workflow-executor.js` (ReferenceError risk)
- `faz2-v4.test.js` uses `expectedSteps` instead of missing `expectedPhases`
- `approve_project` now prefers explicit `projectId` over run lookup (operator precedence fix)
- Desktop guard: app allowlist, sensitive screen detection, coordinate bounds, tesseract OCR
- Team membership: deny-by-default when project has members or `TEAM_MEMBERSHIP_ENFORCE=true`
- Integration pack install validates plugin registration before enable

### Added — V4 Faz 3 (`v4.3`)
- Eval Studio: `/eval/*` API, golden trace registry, regression suite, `EvalStudioPage` at `/eval`
- `npm run eval:ci` — golden trace + faz3 regression gate
- Cost guardrails: preflight estimate, anomaly detection, policy+cost merge (`/usage/preflight`, `/usage/anomalies`)
- Template preview includes `preflight` cost/quota block
- Integration packs: Developer, Knowledge, Ops, Automation, Desktop (`/team/packs`)
- Team membership API (`/team/projects/:id/members`) + per-actor audit filter

### Added — V4 Faz 2 (`v4.1` / `v4.2`)
- Project Command Center: `GET /projects/:name/command-center` BFF + today briefing
- `ProjectCommandCenterPanel` on Projects page (runs, risks, cost, ask/impact widgets)
- Desktop Control MVP: `desktop.core.js`, sidecar `/desktop/*` routes, MCP tools (`desktop_screenshot`, `desktop_active_window`, `desktop_ocr`, `desktop_click`, `desktop_type`)
- Self-Healing: `ci-failure-heal` workflow template + `POST /integrations/ci/heal` trigger

### Added — V4 Faz 1 (`v4.0-alpha` / `v4.0-beta`)
- Platform core: deprecated `jobs/` class stack removed; unified audit entrypoint via `audit/index.js`
- `validate:tools` CI gate with `STRICT_TOOL_SCHEMA=true`
- Agent runtime control APIs: `POST /runs/:id/pause`, `retry-step`, `rollback`, `compare`
- Run state machine guard (`run-state-machine.js`) and per-step workflow timeout
- Workflow template store + CRUD/preview APIs (`workflow-template-store.js`)
- Workflow Designer UI at `/workflows/designer`
- Approval Center Pro: `GET /approvals/:id`, `POST /approvals/:id/decide`, risk score, masked preview
- Approval Center UI at `/approvals`

### Added
- Plugin quality standards with `plugin.meta.json` schema
- Contract testing framework for plugins
- Tool chain analysis and parameter sanitization in security-guard
- Workspace entity model with context middleware
- Correlation ID tracking for observability
- RAG source connectors (GitHub, Notion, File)
- LLM Router cost and latency tracking
- Database abstraction layer with repository pattern
- OpenAPI spec generation from tool registry
- README validation tool

### Changed
- Improved plugin loader with metadata validation
- Enhanced error handling with standardized envelopes
- Updated vitest config with coverage thresholds

### Security
- Added security-guard for dangerous tool chain detection
- Implemented parameter sanitization for SQL injection, path traversal
- Added scope-based authorization checks

## [1.0.0] - 2024

### Added
- Plugin-tabanlı mimari
- MCP (Model Context Protocol) desteği
- REST API
- Policy motoru
- Job kuyruğu (Redis/Memory)
- 30+ plugin entegrasyonu
- Auth scope sistemi (read/write/admin)
- Tool registry
- Observability dashboard

### Plugin'ler
- GitHub entegrasyonu
- Notion entegrasyonu
- n8n entegrasyonu
- Veritabanı (PostgreSQL, MSSQL, MongoDB)
- Dosya depolama (S3, Google Drive, Local)
- Slack bildirimleri
- Git operasyonları
- RAG (Retrieval Augmented Generation)
- LLM router (OpenAI, Claude)
- Ve daha fazlası...

### Security
- API key auth
- Policy-based onay workflow'ları
- Rate limiting
- Scope-based yetkilendirme
