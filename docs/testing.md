# Test ve CI

## Aktif suite (2026-06-24)

```bash
cd mcp-server && npm run test:run
```

| Metrik | Değer |
|--------|-------|
| Test dosyası | ~51 passed |
| Assertion | ~692 passed |
| Exit code | 0 (hedef; image-gen import-time key hatası düzeltildi) |
| Süre | ~3–8 sn |

**Not:** Önceki taramalarda 27 dosya / 443 test görülmüştü. Suite büyüdü; harici değerlendirmede image-gen `OPENAI_API_KEY` import hatası 1 failed suite üretiyordu — lazy client ile giderildi.

---

## Vitest yapılandırması

- **Pool:** `forks` (process isolation)
- **Include:** `tests/**/*.{test,spec}.js`
- **Exclude:** 23 dosya (aşağıda)
- **Coverage threshold:** core %85, plugin index %60–75

### Exclude edilen 23 dosya

| Kategori | Dosyalar |
|----------|----------|
| E2E / smoke | `e2e.test.js`, `smoke.test.js`, `jobs-api.test.js` |
| MCP | `tests/mcp/security.test.js`, `integration.test.js`, `contract.test.js` |
| Plugin loader | `plugin-loader.test.js` |
| Env-heavy plugins | `database`, `secrets`, `notion`, `rag`, `llm-router`, `image-gen`, `local-sidecar`, `code-review`, `tech-detector`, `repo-intelligence`, `project-orchestrator`, `notifications` (genel), `shell`, `shell-hardened`, `shell-policy.integration` |
| Contract | `contract/llm-router.contract.test.js` |

**Toplam disk:** ~50 test dosyası → %46 CI dışı.

Manuel paket: eski `step2-manual-test-pack.md` git geçmişinde; yeniden oluşturulmalı.

---

## Aktif suite kapsamı

### Core (iyi)
tool-registry, security-guard, logger, error-categories, resilience, metrics, plugin-strict (flag only), policy, tenancy, health, tools, observability, plugins helpers, audit, registry, jobs, golden

### Plugin (kısmi)
docker, workspace, file-storage, github, projects, slack, http, email, file-watcher, video-gen, policy, openapi, observability, n8n-workflows, notifications-telegram, shell-timeout (integration)

### Contract (lite)
`contract.test.js`, github.contract, notion.contract

---

## Test dışı kritik modüller

| Modül | Risk |
|-------|------|
| `settings/*` (10 dosya) | Encrypt/decrypt, MSSQL, hot reload |
| `chat-orchestrator.js` | Tool loop, approval, provider seçimi |
| `ui-chat.js` | SSE endpoint |
| `plugin-meta.js` | validatePluginMeta logic |
| `persistence/*` | MSSQL config |
| `redis.js` | Jobs/cache |
| `server.js`, `auth.js`, `config.js` | Boot path |

### Frontend
0 test (Vitest/Jest/Playwright yok).

---

## Bilinen test sorunları

### EMFILE / file-watcher
`tests/plugins/file-watcher.test.js` gerçek fs watcher açıyor (`file_watcher_start` → `src/` dizini watch).

**Risk:** Teardown eksikse fd leak → `EMFILE: too many open files, watch`

**Öneri:**
```javascript
afterAll(async () => {
  // Tüm aktif watcher'ları stop et
  const listTool = fileWatcher.tools.find(t => t.name === "file_watcher_list");
  const { data } = await listTool.handler({});
  for (const w of data.watchers ?? []) {
    const stop = fileWatcher.tools.find(t => t.name === "file_watcher_stop");
    await stop.handler({ watcherId: w.id });
  }
});
```
Veya `fs.watch` mock'la.

### Broken import path (exclude edilmiş MCP testleri)
```javascript
// Yanlış:
import { ... } from "../src/mcp/http-transport.js";
// Doğru:
import { ... } from "../../src/mcp/http-transport.js";
```

### plugin-loader.test.js mock path
Mock `../core/config.js` → `tests/core/config.js` (yanlış). `../../src/core/config.js` olmalı.

### Flaky: shell-timeout.integration.test.js
Gerçek `spawn("sleep")` + timing — aktif CI'da; yavaş runner'da flake riski.

---

## CI workflows

| Workflow | Durum |
|----------|-------|
| `ci.yml` | pnpm, lint + test:run + test:coverage, Node 18/20 |
| `security.yml` | audit, Trivy, TruffleHog, CodeQL |
| `release.yml` | **Sorunlu:** `npm ci` + eksik package-lock.json |

### CI'da olmayan ama olması gereken
- `npm run validate:plugins`
- `format:check`
- Pre-commit'te test yok (sadece lint-staged)

---

## Önerilen test eklemeleri (öncelik)

### P0
1. `settings/crypto.js` — round-trip, bad key
2. `settings/validate.service.js` + `effective-config.js`
3. `settings/routes.js` — supertest + mocked persistence
4. `chat-orchestrator.js` — mock OpenAI/Ollama
5. `plugin-meta.js` — validatePluginMeta full coverage

### P1
6. MCP test import fix + re-enable
7. plugin-loader mock fix
8. file-watcher teardown veya mock

### P2
9. `validate:plugins` CI'ya
10. Release workflow → pnpm align
11. Frontend minimal API client tests
