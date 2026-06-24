# Güvenlik Denetimi

> Kapsam: `mcp-server/src` — `.env` okunmadı

## Executive summary

Settings crypto (AES-256-GCM) ve admin-only `/settings` API sağlam tasarlanmış. En büyük riskler: **plugin REST route'larında tutarsız auth**, **MCP'nin ayrı auth flag'i**, **global rate limit mount edilmemiş**, **security-guard runtime'da yok**.

---

## Critical

### SEC-1: Plugin REST auth bypass (10 plugin)
`requireScope()` sadece explicit kullanılan route'larda çalışır.

| Plugin | Örnek riskli route'lar |
|--------|------------------------|
| notion | `POST /notion/pages`, `DELETE /notion/row/:id` |
| github | PR/branch oluşturma |
| llm-router | `POST /llm/route` (API key harcama) |
| local-sidecar | Dosya okuma/yazma |
| n8n | `POST /n8n/workflow/execute` |
| n8n-credentials | Credential metadata |
| project-orchestrator | `POST .../pr`, `POST .../repo` |
| repo-intelligence, file-watcher, tests | Çeşitli |

**Not:** `HUB_*_KEY` set olsa bile bu endpoint'ler korunmuyor — `requireScope` middleware yok.

### SEC-2: MCP auth opt-in ve REST'ten bağımsız
- `mcp/http-transport.js`: sadece `HUB_AUTH_ENABLED=true` iken token kontrolü
- REST: `HUB_*_KEY` varlığına bağlı
- Dokümantasyonda yeterince belirtilmemiş

### SEC-3: `0.0.0.0` bind
- `index.js`: tüm arayüzlere açık
- Auth eksikliği + network exposure = tam compromise

### SEC-4: Marketplace `npm install`
- `POST /marketplace/install` sunucuda paket kurar
- Open mode'da herkes erişebilir

---

## High

### SEC-5: UI chat — read key ile write tools
`ui-chat.js`: `requireScope("read")` + orchestrator `allowWriteTools: true`

### SEC-6: security-guard kullanılmıyor
`tool-registry.callTool()` security-guard çağırmıyor. SQL/path/command injection kontrolleri dead code.

### SEC-7: Tool inputSchema runtime validation yok
Register'da şema kontrolü var; çağrıda args doğrudan handler'a gidiyor.

### SEC-8: Telegram webhook secret optional (fail-open)
`telegram.webhook.js`: secret yoksa `verifyWebhookSecret` → true

### SEC-9: UI token admin scope
6 haneli token → `["read", "write", "admin"]`. Issuance localhost-only; validation her yerden.

### SEC-10: Policy `?confirmed=true` bypass
Dry-run onayı query string ile atlanıyor, ek auth yok.

### SEC-11: Native notification command injection
`notifications/index.js`: `title`/`message` shell'e interpolate ediliyor.

---

## Medium

| ID | Bulgu | Dosya |
|----|-------|-------|
| SEC-12 | CORS tamamen açık | `server.js` |
| SEC-13 | Rate limit tanımlı, mount yok | `ratelimit.js` |
| SEC-14 | MCP scope enforcement yok | `http-transport.js` |
| SEC-15 | MSSQL `TrustServerCertificate` default true | `persistence/mssql-config.js` |
| SEC-16 | HTTP plugin SSRF — domain allowlist yoksa her şey açık | `plugins/http/policy.js` |
| SEC-17 | Strict mode flag'leri default off | `plugin-strict.js` |
| SEC-18 | Unknown tool tags silently dropped | `tool-registry.js` |
| SEC-19 | Settings import key allowlist yok | `settings/bundle.service.js` |
| SEC-20 | Weak placeholder keys schema'dan geçiyor | `config-schema.js` + `sanity.js` sadece warn |

---

## Low

- Health endpoint auth durumu disclosure (`GET /health`)
- `express.json()` explicit body limit yok
- Helmet / security headers yok
- Audit log'da tool args (secret leak riski)
- OAuth introspection fetch timeout yok
- Telegram UI token plaintext notification'da

---

## İyi uygulamalar

| Alan | Değerlendirme |
|------|---------------|
| Settings crypto | AES-256-GCM, random IV, auth tag |
| Settings routes | Tüm endpoint'ler `requireScope("admin")` |
| Telegram agent | Allowlist deny-by-default, write tools kapalı |
| Shell plugin | Allowlist, dangerous pattern block, cwd validation |
| Policy plugin | Approval workflow hooks |
| MCP origin check | DNS rebinding koruması |
| Hardcoded secrets | Kaynak kodda yok |
| Config log masking | `sanitizeConfig()` |

---

## Production checklist

```
HUB_READ_KEY / HUB_WRITE_KEY / HUB_ADMIN_KEY  → güçlü random
HUB_AUTH_ENABLED=true                          → MCP için zorunlu
NODE_ENV=production
TELEGRAM_WEBHOOK_SECRET                        → webhook açıksa zorunlu
TELEGRAM_ALLOWED_CHAT_IDS                      → bot için zorunlu
HTTP_ALLOWED_DOMAINS                           → explicit allowlist
STRICT_PLUGIN_LOADING / STRICT_PLUGIN_META / STRICT_TOOL_SCHEMA = true
REQUIRE_PROJECT_HEADERS=true                   → multi-tenant
MCP_ALLOWED_ORIGINS                            → production origin'ler
Bind                                           → 127.0.0.1 veya reverse proxy arkası
CORS                                           → bilinen UI origin'leri
Rate limiting                                  → rateLimitMiddleware mount et
```
