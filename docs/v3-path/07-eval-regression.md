# 07 — Eval ve Regression Sistemi

> **Status:** mvp_done (v3.6) — 4 golden traces + schema snapshot; nightly → v3.7  
> **Last reviewed:** 2026-06-25  
> **Öncelik:** P2 (Faz 3)  
> **Bağımlılık:** [01-agent-runtime-workflow.md](./01-agent-runtime-workflow.md), [05-connector-marketplace.md](./05-connector-marketplace.md)

---

## Amaç

Agent platformlarında asıl sorun: **bugün iyi çalışan yarın bozuluyor**. Prompt eval setleri, tool-call golden traces, MCP contract regression, agent task benchmark — model/provider değişince kalite ölçümü.

---

## Mevcut durum

| Var | Eksik |
|-----|-------|
| `tests/` — 710+ unit/integration | Agent-level eval |
| `validate:plugins` | Tool schema regression |
| `tests` plugin | Eval harness değil |
| CI `test:run` | Nightly agent benchmark yok |

**İlgili:** `mcp-server/tests/`, `.github/workflows/`

---

## Eval türleri

| Tür | Ne ölçer | Örnek |
|-----|----------|-------|
| **Prompt eval** | LLM çıktı kalitesi | "Auth açıklaması doğru mu?" |
| **Tool trace golden** | Beklenen tool sırası/args | `project_init` → `git_create_branch` |
| **MCP contract** | Schema + response shape | `inputSchema` değişimi yakalar |
| **Agent task benchmark** | End-to-end görev | "Issue aç + branch + PR" |
| **Version diff** | Önceki sürüm vs şimdi | Aynı görev, farklı commit |

---

## Mimari

```
eval/
├── datasets/
│   ├── prompts/           # JSONL: input, expected_contains, rubric
│   ├── tool-traces/       # golden step sequences
│   └── agent-tasks/       # multi-step scenarios
├── runners/
│   ├── prompt-eval.js
│   ├── trace-compare.js
│   └── agent-benchmark.js
└── reports/
    └── {run_id}.json
```

CI: `npm run eval:smoke` (hızlı), `eval:nightly` (tam suite).

---

## Golden trace formatı

```json
{
  "name": "repo-analysis-issue-flow",
  "steps": [
    { "tool": "repo_intelligence.analyze", "argsMatch": { "repo": "*" } },
    { "tool": "github.create_issue", "argsMatch": { "title": ".*" } }
  ],
  "tolerances": { "extraSteps": 1, "orderStrict": false }
}
```

Karşılaştırma: gerçek run steps vs golden — diff raporu.

---

## Prompt eval formatı

```json
{
  "id": "auth-explain-01",
  "input": "Bu projede auth nasıl çalışıyor?",
  "context": { "project_id": "demo" },
  "assertions": [
    { "type": "contains", "value": "JWT" },
    { "type": "llm_judge", "rubric": "Teknik olarak doğru ve eksiksiz" }
  ]
}
```

`llm_judge`: opsiyonel — ayrı küçük model veya rule-based fallback.

---

## Uygulama fazları

### Faz A — Tool trace regression (1 hafta)

- [ ] Golden trace dosya formatı
- [ ] `trace-compare.js` — run export vs golden
- [ ] CI: 3-5 kritik trace smoke test

### Faz B — MCP contract (mevcut genişletme) (1 hafta)

- [ ] `validate:plugins` çıktısını snapshot'la karşılaştır
- [ ] Breaking schema change → CI fail

### Faz C — Agent task benchmark (2 hafta)

- [ ] Mock/sandbox ortam (gerçek GitHub yerine test repo)
- [ ] `agent-benchmark.js` — orchestrator dry-run veya sandbox
- [ ] Skor: başarı, süre, maliyet, step sayısı

### Faz D — Version diff + model swap (1 hafta)

- [ ] `eval:compare --baseline v1.2 --current HEAD`
- [ ] Provider değişince otomatik eval tetikle (CI matrix)

---

## Metrikler

| Metrik | Açıklama |
|--------|----------|
| Pass rate | Görev başarı % |
| Trace fidelity | Golden ile uyum |
| Latency p95 | Süre |
| Cost per task | USD |
| Regression delta | Baseline'a göre fark |

---

## Exit criteria

- [ ] PR'da en az 1 golden trace smoke geçer
- [ ] Tool schema breaking change CI'da yakalanır
- [ ] Nightly agent benchmark raporu artifact olarak saklanır
- [ ] Model/provider değişikliği öncesi eval checklist dokümante

**Sonraki:** [10-production-hardening.md](./10-production-hardening.md) (CI entegrasyonu)
