# Öncelikli Aksiyon Planı

Harici değerlendirme + kod taraması sentezi. Yeni özellik eklemeden önce bu sıra önerilir.

---

## Sprint 1 — Güvenlik ve config (1–2 hafta)

### 1.1 Config davranışını tek karara indir
- [ ] `config-schema.js`: dev'de optional key, production'da zorunlu
- [ ] Weak key detection (`dev`, `test`, `changeme`) → production'da block
- [ ] `.env.example` oluştur/güncelle
- [ ] `HUB_AUTH_ENABLED` dokümante et ve production default'u netleştir

### 1.2 Plugin auth gap kapat (10 plugin)
- [ ] notion, github, llm-router, local-sidecar → `requireScope` ekle
- [ ] n8n, n8n-credentials, project-orchestrator → `requireScope` ekle
- [ ] repo-intelligence, file-watcher, tests → `requireScope` ekle

### 1.3 UI chat scope fix
- [ ] `ui-chat.js`: write tools için `requireScope("write")` veya orchestrator'da scope check

### 1.4 Marketplace kilitle
- [ ] `requireScope("admin")` + `ENABLE_MARKETPLACE` default false

### 1.5 MCP + REST auth birleştir
- [ ] Tek flag / tek key check; `http-transport.js` refactor

---

## Sprint 2 — Test güvenilirliği (1 hafta)

### 2.1 file-watcher teardown
- [ ] `afterAll` watcher cleanup veya fs.watch mock
- [ ] EMFILE repro varsa CI'da `ulimit -n` notu

### 2.2 Kritik modül testleri
- [ ] `settings/crypto.js`
- [ ] `chat-orchestrator.js` (mock provider)
- [ ] `plugin-meta.js` validation

### 2.3 CI iyileştirmeleri
- [ ] `validate:plugins` → ci.yml
- [ ] Release workflow → pnpm align
- [ ] MCP test import path fix

### 2.4 Manuel test paketi
- [ ] `docs/manual-test-pack.md` yeniden yaz (exclude edilen 23 dosya için)

---

## Sprint 3 — Platform omurgası (2 hafta)

### 3.1 Registry tek kaynak
- [ ] Karar: `plugins.js` + `tool-registry.js` kalır
- [ ] `core/registry/` ve `core/tools/tool.registry.js` → deprecate veya startup wire
- [ ] Observability health fix (`registry.total === 0` bug)

### 3.2 Jobs tek implementasyon
- [ ] Redis fallback bug fix (`jobs.js`)
- [ ] `job.manager.js` ya entegre ya kaldır

### 3.3 security-guard wire
- [ ] `callTool()` öncesi arg sanitization + scope check
- [ ] Runtime `inputSchema` validation

### 3.4 Rate limit mount
- [ ] `server.js` → `rateLimitMiddleware`

### 3.5 Audit API birleştir
- [ ] Tek `auditLog()` entry point; plugin-local audit kaldır

---

## Sprint 4 — Standartlar ve kalite (1–2 hafta)

### 4.1 plugin.meta.json kalite
- [ ] `envVars` doldur (notifications, brain, ...)
- [ ] Description güncelle
- [ ] Status'ları gerçek maturity ile hizala

### 4.2 explanation field
- [ ] Write/destructive tool'lara `explanation` ekle
- [ ] `STRICT_TOOL_SCHEMA=true` production default

### 4.3 Health routes
- [ ] 14 eksik plugin'e `GET /<plugin>/health`

### 4.4 God plugin split
- [ ] notion → modüllere böl
- [ ] llm-router → modüllere böl

### 4.5 Frontend hygiene
- [ ] `src/public/app/assets/` → gitignore + CI build
- [ ] `x-project-id` header gönderimi
- [ ] Minimal frontend test

---

## Sprint 5 — Integration test stratejisi (ongoing)

### Seçenek A: Mock'la aktif suite'e al
- [ ] Exclude listesinden 5'er 5'er çıkar
- [ ] `audit-mock.js`, env stub pattern'leri kullan

### Seçenek B: Ayrı CI job
- [ ] `integration.yml` — env-heavy, `continue-on-error` veya nightly
- [ ] Sonuçlar görünür ama merge blocker değil

---

## Hızlı kazanımlar (< 1 gün)

| Aksiyon | Etki |
|---------|------|
| `validate:plugins` CI'ya | Meta regression önler |
| `openapi-generator.js` sil veya fix | Dead code temizliği |
| `unhandledRejection` → exit (prod) | Zombie process önler |
| Telegram webhook secret zorunlu | Fail-closed |
| CORS origin whitelist | CSRF riski azalır |

---

## Başarı kriterleri

- [ ] `npm run test:run` her ortamda exit 0
- [ ] Tüm plugin REST route'ları auth korumalı
- [ ] MCP + REST aynı auth modeli
- [ ] Tek registry, tek jobs, tek audit API
- [ ] Settings + chat orchestrator testli
- [ ] Production checklist (security.md) uygulanabilir
