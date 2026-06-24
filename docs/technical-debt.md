# Teknik Borç

## P0 — Platform omurgası

### TD-1: Çift registry / jobs / audit stack — **Resolved (Faz 0)**
- **Çözüm:** `tool-registry.js` + `jobs.js` canonical; observability metrics güncellendi; `audit.service.js` tek write path

### TD-3: MCP auth REST'ten ayrı — **Resolved (Faz 0)**
- **Çözüm:** `authenticateRequest`, `validateBearerToken` UI token paritesi; `optionalAuthMiddleware`

### TD-6: Rate limiting tanımlı ama mount edilmemiş — **Resolved**
- Zaten `server.js`'de mount edilmiş; dokümantasyon güncellendi

### TD-8: Policy `?confirmed=true` bypass — **Resolved (Faz 0)**
- Admin scope zorunlu

### TD-9: Redis job enqueue fallback bug — **Resolved (Faz 0)**
- Memory fallback `runJob` ile tutarlı; `useMemoryStore` flag

### TD-11: Job state enum tutarsızlığı — **Partial**
- `JobState.DONE` → `COMPLETED` alias; `publicView` normalizes

### TD-2: Config schema vs open mode çelişkisi — **Resolved**
- **Dosyalar:** `config-schema.js`, `auth.js`
- **Eski sorun:** Schema key zorunlu ↔ auth open mode çelişkisi
- **Çözüm:** Auth key'ler `.default("")`; production'da `validateProductionAuth()` + weak-key block

### TD-3: MCP auth REST'ten ayrı
- **Dosyalar:** `mcp/http-transport.js` (`HUB_AUTH_ENABLED`) vs `auth.js` (`HUB_*_KEY`)
- **Etki:** REST kilitli, MCP açık olabilir
- **Çözüm:** Birleştir, dokümante et

---

## P1 — Güvenlik borcu

### TD-4: 10 plugin requireScope kullanmıyor
notion, github, llm-router, n8n, n8n-credentials, local-sidecar, project-orchestrator, repo-intelligence, file-watcher, tests

### TD-5: security-guard production'da wire edilmemiş
- Sadece testlerde (`tests/core/security-guard.test.js`)
- `callTool()` args validation yapmıyor

### TD-6: Rate limiting tanımlı ama mount edilmemiş
- `core/ratelimit.js` export ediyor, `server.js` import etmiyor

### TD-7: UI chat read scope + write tools
- `ui-chat.js`: `requireScope("read")` + `allowWriteTools: true`

### TD-8: Policy `?confirmed=true` bypass
- `policy-guard.js`: ek auth olmadan dry-run atlanıyor

---

## P2 — Güvenilirlik

### TD-9: Redis job enqueue fallback bug
- Enqueue fail → memory Map'e yazılıyor
- `runJob()` Redis'ten okuyor → job asla çalışmayabilir (202 dönüp kaybolur)
- **Dosya:** `core/jobs.js`

### TD-10: unhandledRejection exit yapmıyor
- `index.js`: `uncaughtException` → exit(1); `unhandledRejection` → sadece log

### TD-11: Job state enum tutarsızlığı
- `COMPLETED` vs `DONE`; Redis `"completed"` string

### TD-12: openapi-generator.js broken
- `getTools` import ediyor; `listTools` var. Kullanılmıyor.

---

## P3 — Kod kalitesi

### TD-13: God plugin dosyaları
- `notion/index.js` ~1940 satır
- `llm-router/index.js` ~1368 satır

### TD-14: Sentry hollow integration
- `SENTRY_DSN` config var, `@sentry/node` dependency yok

### TD-15: Silent catch {} blokları
- marketplace, git, brain, prompt-registry, file-storage — hatalar boş data olarak dönüyor

### TD-16: Frontend build çıktıları tracked
- `src/public/app/assets/` — diff gürültüsü, review zorlaşır
- Alternatif: CI'da build, gitignore assets

### TD-17: Lint borcu
- 19 error, 258 warning (`npm run lint`)

### TD-18: Marketplace npm install
- Open mode'da supply-chain riski; admin scope + disable flag gerekli

---

## P4 — Test borcu

### TD-19: Step 2 kritik modüller test dışı
- `settings/*` (10 dosya), `chat-orchestrator.js`, `ui-chat.js`, `persistence/*`, `plugin-meta.js` validation logic

### TD-20: 23 test dosyası exclude
- MCP testleri broken import (`../src/` → `../../src/` olmalı)
- `plugin-loader.test.js` mock path'leri yanlış

### TD-21: file-watcher EMFILE riski
- Gerçek fs watcher testleri teardown eksikse fd leak
- Ortama bağlı; `afterAll` ile tüm watcher'ları stop etmek gerekir

### TD-22: validate:plugins CI'da yok — **Resolved (Faz 0)**
### TD-23: Release workflow npm vs pnpm uyumsuzluğu — **Resolved (Faz 0)**
- release.yml pnpm + lint + validate:plugins

### TD-24: Frontend 0 test

---

## P5 — Metadata / standartlar

### TD-25: plugin.meta.json scaffold kalitesi — **Partial (Faz 0)**
- 35/35 security manifest (`riskLevel`, `capabilities`, `requiresApproval`)
- `sync-plugin-meta-env.js` + `sync-plugin-security-manifest.js`

### TD-26: explanation field standardı
- Sadece `STRICT_TOOL_SCHEMA=true` ile zorunlu
- Birçok write tool'da yok (slack, docker, vb.)

### TD-27: 14 plugin health route eksik
github, llm-router, notion, shell, n8n-credentials, file-watcher, notifications, image-gen, local-sidecar, marketplace, docker, tests, slack, video-gen

### TD-28: prompt-registry v1 deprecation açık
- v1 hâlâ migrate ediliyor, warning veriyor

### TD-29: Audit API parçalanmış — **Partial (Faz 0)**
- `audit.service.js` + `/audit/events`; file-storage local buffer kaldırılmadı (opsiyonel)

---

## Çözülmüş / kısmen çözülmüş (eski borç kayıtları)

| Konu | Durum |
|------|-------|
| slack/email/image-gen/video-gen auth | 6E ile `requireScope` eklendi |
| RAG Ollama fallback | `rag/index.js`'de implement |
| project-orchestrator self-HTTP | `callTool` kullanıyor, localhost fetch yok |
| plugin.meta.json dosya varlığı | 35/35 tamam |
