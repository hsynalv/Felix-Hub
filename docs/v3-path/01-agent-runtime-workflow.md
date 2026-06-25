# 01 — Agent Runtime / Workflow Katmanı

> **Status:** v1 done (2026-06-24) — v2 backlog Faz 5  
> **Öncelik:** P0 (Faz 1 tamamlandı); v2 = Faz 5  
> **Bağımlılık:** [10-production-hardening.md](./10-production-hardening.md) (jobs + audit tek kaynak)

---

## Amaç

Tool hub'un üzerine **agent çalıştırma motoru** eklemek: çok adımlı planlar, tool-call history, retry/rollback, approval checkpoint, uzun süren run'lar, replay/resume ve timeline.

**Örnek senaryo:** *"Repo analiz et → issue aç → branch oluştur → kodu değiştir → test koş → PR aç"* tek `run_id` altında izlenebilmeli.

---

## Mevcut durum

| Var | Eksik |
|-----|-------|
| `chat-orchestrator.js` — LLM + tool loop, SSE | Run entity yok (sadece conversation) |
| `project-orchestrator` — `project_init` vb. | Genel workflow engine değil |
| `jobs.js` — async job queue | Agent run ≠ job (ayrı modeller) |
| `audit/` — tool archive | Run ile ilişkilendirilmiş değil |
| Chat approval (SSE `onApproval`) | Checkpoint persistence + resume |

**İlgili dosyalar:** `mcp-server/src/core/chat-orchestrator.js`, `mcp-server/src/core/jobs.js`, `mcp-server/src/plugins/project-orchestrator/index.js`

---

## Hedef mimari

```mermaid
sequenceDiagram
  participant UI as RunDashboard
  participant API as AgentRuntimeAPI
  participant Orch as RunOrchestrator
  participant TR as ToolRegistry
  participant Pol as PolicyGuard
  participant DB as Persistence

  UI->>API: POST /runs { goal, projectId }
  API->>DB: create run pending
  API->>Orch: startRun(runId)
  loop steps
    Orch->>Pol: evaluate(tool, context)
    alt needs approval
      Orch->>DB: checkpoint waiting_approval
      Orch-->>UI: SSE status
      UI->>API: POST /runs/:id/approve
    end
    Orch->>TR: callTool
    Orch->>DB: append step trace
  end
  Orch->>DB: run completed
```

---

## Veri modeli (öneri)

### `agent_runs`

| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | UUID | `run_id` |
| `project_id` | string? | Workspace bağlamı |
| `conversation_id` | UUID? | Chat ile köprü |
| `goal` | text | Kullanıcı hedefi / plan özeti |
| `status` | enum | `pending`, `running`, `waiting_approval`, `paused`, `completed`, `failed`, `cancelled` |
| `current_step` | int | Sıra numarası |
| `plan` | JSON | Fazlar / görevler (project-orchestrator uyumlu) |
| `metadata` | JSON | model, plugin filter, priority |
| `created_by` | string | user / api key id |
| `started_at`, `finished_at` | datetime | |
| `error` | JSON? | Son hata |

### `agent_run_steps`

| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | UUID | |
| `run_id` | UUID | FK |
| `step_index` | int | |
| `type` | enum | `llm`, `tool`, `approval`, `system` |
| `tool_name` | string? | |
| `input` | JSON | masked secrets |
| `output` | JSON | |
| `status` | enum | `ok`, `error`, `skipped`, `pending` |
| `duration_ms` | int | |
| `retry_count` | int | |
| `usage` | JSON | token/cost snapshot |

### `agent_run_checkpoints`

Onay veya pause noktaları — resume için `last_checkpoint_id`.

---

## API yüzeyi (öneri)

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/runs` | Yeni run başlat |
| GET | `/runs` | Liste (filter: project, status) |
| GET | `/runs/:id` | Detay + steps özeti |
| GET | `/runs/:id/steps` | Paginated trace |
| GET | `/runs/:id/events` | SSE stream (chat benzeri) |
| POST | `/runs/:id/approve` | Checkpoint onayı |
| POST | `/runs/:id/cancel` | İptal |
| POST | `/runs/:id/resume` | Checkpoint'ten devam |
| POST | `/runs/:id/replay` | Salt okunur replay (yeni run veya dry-run) |

MCP tool: `agent_run_status`, `agent_run_list` (read scope).

---

## Uygulama fazları

### Faz A — Run modeli + chat köprüsü (2 hafta)

- [x] Migration: `agent_runs`, `agent_run_steps`, `agent_run_checkpoints`
- [x] `run-orchestrator.js` — chat ile köprü
- [x] Her chat turn'de `run_id` üret / conversation'a bağlı run devam ettir
- [x] Tool call'ları `agent_run_steps`'e yaz
- [x] Audit'e `run_id` metadata eklendi
- [x] REST API: `POST/GET /runs`, `/runs/:id/steps`, cancel/approve/resume

**Exit:** Chat'ten yapılan tool call'lar run step olarak görünür (memory veya MSSQL).

### Faz B — Job entegrasyonu + uzun run (2 hafta)

- [x] `job.type = agent_run` — `agent-run-job.js` + `registerAgentRunJobRunner()`
- [x] `POST /runs` `async: true` → background job
- [x] `GET /runs/:id/events` SSE + `run-events.js` pub/sub
- [x] Timeout (`AGENT_RUN_TIMEOUT_MS`, varsayılan 30 dk) + cancel → job iptal
- [x] Chat SSE `run_step` event'leri

**Exit:** 10+ dakika süren run UI'da kaybolmaz.

### Faz C — Retry, rollback, replay (2 hafta)

- [x] Step-level retry policy (transient errors) — `tool-retry.js`, chat orchestrator
- [ ] Compensating action hook (plugin opt-in) — gelecek
- [x] Replay: `POST /runs/:id/replay` (dry-run trace kopyası)
- [x] Resume: `POST /runs/:id/resume` + approval bridge

**Exit:** Onay reddedilince run `cancelled`; replay ile trace yeniden oynatılabilir.

### Faz D — Workflow şablonları (2 hafta)

- [x] `workflow-templates.js` — `repo-ship-feature`, `incident-triage`
- [x] `POST /runs/from-template/:id` + `workflow_run` job
- [x] Template parametreleri: repo, branch, goal, baseBranch
- [x] MCP: `agent_run_list`, `agent_run_status`, `agent_workflow_templates`

**Exit:** Örnek 6 adımlı repo workflow tek tıkla başlatılabilir (`/runs` UI).

---

## Chat orchestrator entegrasyonu

1. `streamChat()` başında `ensureRun(conversationId)` 
2. `onTool` → `appendRunStep(runId, { type: 'tool', ... })`
3. `onApproval` → run status `waiting_approval`, checkpoint kaydı
4. `onDone` → usage + run `completed`

Mevcut `conversations` tablosu korunur; `agent_runs.conversation_id` optional FK.

---

## Retry politikası

| Hata sınıfı | Davranış |
|-------------|----------|
| `notion_rate_limited`, network | Otomatik retry (max 3) |
| `insufficient_scope`, policy deny | Retry yok; run pause veya fail |
| Tool execution error | Orchestrator kararı; kullanıcıya sor |

---

## Güvenlik

- Run başlatma: `write` scope
- Run listesi: `read` veya project membership (gelecek)
- Step input/output: secret mask (`settings/crypto` pattern)
- Replay: destructive tool'lar dry-run veya mock

---

## Test planı

- [ ] Unit: RunOrchestrator state machine
- [x] Integration: agent-runs memory tests
- [x] Approval bridge: chat waiter + tool exec (`approval-bridge.test.js`)
- [x] Golden trace: `tests/fixtures/runs/repo-ship-feature.json`

---

## Exit criteria (pillar tamamlandı)

- [x] Run CRUD API + persistence
- [x] Chat run'a bağlı (`ensureRunForChat`, `run_id` metadata)
- [x] Approval checkpoint resume (`approval-bridge` + chat waiter)
- [x] En az 1 workflow template dokümante (Faz D)
- [x] Timeline UI (Pillar 04) bu API'yi tüketiyor

---

## Riskler

| Risk | Azaltma |
|------|---------|
| chat-orchestrator şişmesi | Ayrı `run-orchestrator.js` modülü |
| jobs çift stack | Pillar 10 önce |
| Trace boyutu | Step output truncate + blob storage (file-storage plugin) |

**Sonraki:** [02-policy-approval-center.md](./02-policy-approval-center.md), [04-visual-run-dashboard.md](./04-visual-run-dashboard.md)

---

## v2 backlog (Faz 5)

| Özellik | Durum | Not |
|---------|--------|-----|
| Formal state machine (transition guards) | planned | `RunStatus` geçiş tablosu |
| Conditional / branch steps | planned | `when` expression, `branch` step tipi |
| Durable checkpoint resume | planned | Workflow crash sonrası step cursor'dan devam |
| Compensating rollback hook | planned | Step `compensate` opt-in |
| Replay with re-execution | planned | Şu an dry trace clone |
| Per-step retry policy UI | planned | `retry_count` persist + template `maxRetries` |
| Runs UI: template form, SSE, approval | in_progress | `WorkflowTemplateDialog`, `useRunEvents` |
