# Core 20 Plugin (PLAN-V2)

PLAN-V2, mcp-hub'un **production-ready AI geliştirme platformu** hedefini tanımlar: 20 plugin, dört katman, tutarlı core standartları ve tam MCP erişimi.

Kaynak: [PLAN-V2.md](../../PLAN-V2.md)

---

## Mimari Diyagram

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Zeka Katmanı                          │
│   llm-router · brain · rag · prompt-registry               │
├─────────────────────────────────────────────────────────────┤
│                    Kod & Git Katmanı                        │
│   github · git · shell · workspace · code-review           │
│   repo-intelligence · github-pattern-analyzer              │
├─────────────────────────────────────────────────────────────┤
│                    Proje & Otomasyon                        │
│   project-orchestrator · n8n · n8n-workflows               │
│   notion · tech-detector                                    │
├─────────────────────────────────────────────────────────────┤
│                    Altyapı & Güvenlik                       │
│   database · secrets · http · observability                │
└─────────────────────────────────────────────────────────────┘
```

---

## Faz Geçmişi

| Faz | Plugin sayısı | Durum |
|-----|---------------|-------|
| Faz 1 | 11 | ✅ Tamamlandı |
| Faz 2 | +9 = 20 | ✅ Kodda tamamlandı |
| Faz 3 | Core 20 üzerine premium özellikler | 🟡 Büyük ölçüde uygulandı |
| Extension | +15 plugin | ✅ Yüklü, çeşitli olgunluk |

**Faz 1 (11):** llm-router, notion, github, database, shell, rag, brain, github-pattern-analyzer, n8n, repo-intelligence, project-orchestrator

**Faz 2 (+9):** http, secrets, workspace, git, prompt-registry, observability, tech-detector, n8n-workflows, code-review

---

## Katman 1: AI Zeka (4 plugin)

### llm-router

| Özellik | Değer |
|---------|-------|
| Versiyon | 1.0.0 |
| Risk | MEDIUM |
| Bağımlılık | OpenAI, Anthropic, Google, Ollama API key'leri (opsiyonel) |

**Ne yapar:** Görev tipine göre LLM sağlayıcı seçimi, maliyet tahmini, model karşılaştırma.

**Temel endpoint'ler:** `/llm/route`, `/llm/compare`, `/llm/models`, `/llm/estimate-cost`

**MCP tool'ları:** `llm_route`, `llm_compare`, `llm_list_models`, vb.

**Not:** Diğer AI plugin'lerin merkezi LLM gateway'i — kendi `callLLM()` kopyası kullanılmamalı.

---

### brain

| Özellik | Değer |
|---------|-------|
| Versiyon | 2.1.0 |
| Risk | MEDIUM |
| MCP tools | 16+ |

**Ne yapar:** Kişisel AI hafıza motoru — profil, episodik memory, proje registry, alışkanlık analizi, context assembly.

**Faz 3 eklemeleri:**
- `brain_think` — Devin pattern reasoning scratchpad
- `includeThoughts` context parametresi

**Temel MCP tool'ları:** `brain_remember`, `brain_recall`, `brain_register_project`, `brain_build_context`, `brain_think`

---

### rag

| Özellik | Değer |
|---------|-------|
| Versiyon | 1.1.0 |
| Risk | MEDIUM |

**Ne yapar:** Doküman indeksleme ve semantik arama. `OPENAI_API_KEY` ile gerçek embedding; yoksa keyword fallback.

**MCP tool'ları:** `rag_index`, `rag_search`, `rag_delete`, `rag_list`

---

### prompt-registry

| Özellik | Değer |
|---------|-------|
| Versiyon | 2.0.0 |
| Risk | LOW |

**Ne yapar:** Section-based system prompt yönetimi (Faz 3 tam yeniden tasarım).

**Section'lar:** identity, capabilities, flow, tool_calling, response_style, code_style, context_understanding, memory_injection, preferences_injection, completion_spec, non_compliance, todo_spec

**Context slot'ları:** `{{brain.recent_memories}}`, `{{brain.user_preferences}}`, `{{current_date}}`, `{{workspace_root}}`

**Faz 3 MCP tool'ları:** `prompt_render`, `prompt_sections`, `prompt_list`, `prompt_create`, `prompt_update`

---

## Katman 2: Kod & Git (7 plugin)

### github

GitHub repo, PR, branch, issue, comment yönetimi. REST + MCP tam destek.

### git

Yerel git: status, diff, branch, commit, push, pull, stash. `WORKSPACE_BASE` path validation.

### shell

Shell komut çalıştırma; allowlist + tehlikeli pattern engelleme.

**Faz 3 — Stateful sessions:**
- `shell_session_create`, `shell_session_list`, `shell_session_output`, `shell_session_close`
- `shell_execute` → `session_id`, `is_background` parametreleri

### workspace

`WORKSPACE_ROOT` içinde güvenli dosya CRUD, arama, patch. Path traversal koruması.

### code-review

LLM destekli kod inceleme, güvenlik taraması, kalite kontrolü. `llm-router` + `workspace` bağımlılığı.

### repo-intelligence

Repo yapı analizi, AI özetleri, kod metrikleri.

**Faz 3:** `repo_similar_commits` — Augment pattern geçmiş commit benzerliği.

### github-pattern-analyzer

GitHub repo'lardan pattern öğrenme ve öneri. Redis cache destekli.

---

## Katman 3: Proje & Otomasyon (5 plugin)

### project-orchestrator

AI destekli proje planlama ve yürütme. Notion, GitHub, Redis entegrasyonu.

**Faz 3 — Kiro pattern:**
- Spec → Plan → Implement zinciri
- `POST /project-orchestrator/draft/:id/execute` — onaylı plan yürütme

### n8n

n8n workflow katalog arama, örnekler, çalıştırma (9 MCP tool).

### n8n-workflows

Workflow CRUD, aktivasyon/deaktivasyon, disk cache. `N8N_API_KEY` gerekli.

### notion

Notion sayfa, veritabanı, proje ve görev yönetimi. Pagination destekli.

### tech-detector

~50 tech pattern ile proje stack tespiti. Dosya tabanlı analiz, harici API yok.

---

## Katman 4: Altyapı & Güvenlik (4 plugin)

### database

MSSQL, PostgreSQL, MongoDB adapter'ları. Read-only mod, query limitleri.

### secrets

Agent'lar asla gerçek secret görmez. `{{secret:NAME}}` template çözümleme.

**MCP tool'ları:** `secret_list`, `secret_register`, `secret_unregister`, `secret_resolve_check`

### http

SSRF korumalı HTTP client: domain allowlist/blocklist, rate limit, response cache, secret header injection.

**MCP tool'ları:** `http_request`, `http_cache_clear`, `http_policy_info`

### observability

Aggregate plugin health, Prometheus metrics, error surfacing, web dashboard.

**Endpoint'ler:** `/observability/health`, `/observability/metrics`, `/observability/dashboard`

---

## Evrensel Standardizasyon Checklist

Her core 20 plugin bu maddeleri karşılamalı:

```
[ ] createMetadata() — PluginStatus, RiskLevel, endpoints[]
[ ] createPluginErrorHandler(pluginName)
[ ] auditLog() — write operasyonlarında (REST + MCP)
[ ] requireScope("read"|"write") — REST route'larda
[ ] ToolTags — MCP tool'larda
[ ] inputSchema (parameters değil)
[ ] register(app) gerçek route mount
[ ] Kendi callLLM() kopyası yok — llm-router
[ ] GET /<plugin>/health
[ ] En az 3 MCP tool
```

---

## Geliştirme Sırası (Faz 2 — Tamamlandı)

| Sıra | Plugin | Durum |
|------|--------|-------|
| 1 | http | ✅ |
| 2 | secrets | ✅ |
| 3 | workspace | ✅ |
| 4 | git | ✅ |
| 5 | prompt-registry | ✅ (Faz 3 ile v2) |
| 6 | observability | ✅ |
| 7 | tech-detector | ✅ |
| 8 | n8n-workflows | ✅ |
| 9 | code-review | ✅ |

---

## Admin Panel Entegrasyonu

`/admin` → **20 Plugins** sekmesi:

- Katman bazlı gruplama
- Yüklü/yüklenmedi durumu
- Tool sayısı
- Health ve audit linkleri

Aynı Bearer token (read scope) ile erişilir.

---

## İlgili Belgeler

- [Plugin Genel Bakış](./overview.md)
- [Faz 3 Özeti](../roadmap/phase3-summary.md)
- [Plugin Geliştirme](./development.md)
- [PLAN-V2.md](../../PLAN-V2.md)
