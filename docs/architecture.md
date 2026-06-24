# Mimari

## Repo yapısı

```
mcp-hub/
├── mcp-server/          # Ana Node.js uygulaması (ai-hub, port 8787)
│   ├── src/
│   │   ├── core/        # Express, config, auth, plugins, tools, jobs, settings
│   │   ├── plugins/     # 35 plugin (her biri index.js + plugin.meta.json)
│   │   ├── mcp/         # MCP JSON-RPC gateway (/mcp)
│   │   └── public/app/  # React SPA build çıktısı (tracked)
│   ├── frontend/        # React 19 + Vite kaynak
│   └── tests/           # Vitest
├── obsidian-plugin/     # Obsidian community plugin (ayrı paket)
└── docs/                # Bu dokümantasyon
```

## Request flow

```
Client (Browser / AI / MCP)
        │
        ▼
   Express (server.js)
        │
   Middleware chain:
   CORS → Morgan → JSON → correlationId → projectContext → workspaceContext
        → audit → responseEnvelope → policyGuard (writes) → routes
        │
        ├── REST plugins (/github, /notion, /settings, ...)
        ├── UI routes (/ui/chat, /ui/token)
        ├── Jobs (/jobs)
        └── MCP (/mcp) ──► tool-registry.callTool()
```

## Plugin yükleme

`core/plugins.js`:
1. `src/plugins/*/index.js` tarar
2. `plugin.meta.json` validate eder (`STRICT_PLUGIN_META` ile zorunlu)
3. `register(app)` çağırır
4. Tool'ları `registerTool()` ile registry'ye ekler
5. Başarısız plugin server'ı çökertmez (`STRICT_PLUGIN_LOADING` ile zorunlu fail)

## Tool çağrı hattı

```
REST handler / MCP gateway / chat-orchestrator / approval flow
                        │
                        ▼
              tool-registry.callTool(name, args, context)
                        │
              beforeExecution hooks (policy)
                        │
              plugin handler
                        │
              afterExecution hooks + audit
```

## Çift mimari problemi (kritik)

Startup'ta (`createServer()`) sadece **eski hat** wire ediliyor:

| Bileşen | Startup'ta aktif? | Kullanan modüller |
|---------|-------------------|-------------------|
| `plugins.js` + `getPlugins()` | ✅ | REST, observability plugin |
| `tool-registry.js` + `listTools()` | ✅ | REST, MCP, chat |
| `jobs.js` | ✅ | `POST /jobs` |
| `core/registry/plugin.registry.js` | ❌ | `runtime.stats.js`, observability manager |
| `core/tools/tool.registry.js` | ❌ | Aynı |
| `core/jobs/job.manager.js` | ❌ | Observability metrics |

**Belirti:** `getHealthStatus()` registry boşken sistem "unhealthy" dönebilir; tool stats 0 görünür.

**Öneri:** Tek stack seç — ya yeni registry'yi startup'a bağla ya da ölü kodu kaldır.

## Settings katmanı (Step 2)

```
.env (base) + MSSQL settings store (overlay)
        │
        ▼
effective-config.js  →  hot-reload keys / restart-required keys
        │
        ├── reload-registry.js (Redis, Telegram, LLM, ...)
        └── settings/routes.js (admin-only REST API)
```

Şifreleme: `settings/crypto.js` — AES-256-GCM, `HUB_SETTINGS_MASTER_KEY`.

## Chat hattı

```
ChatPage.tsx → POST /ui/chat → ui-chat.js → chat-orchestrator.js
                                                    │
                                    OpenAI / Ollama fallback
                                                    │
                                    tool-registry (approval loop)
```

Telegram bot aynı orchestrator'ı kullanır (`allowWriteTools: false`).

## Frontend

- React 19 + Vite + TanStack Query
- Build: `frontend/` → `mcp-server/src/public/app/`
- API key `localStorage`'da; `x-project-id` / `x-env` header'ları gönderilmiyor (server default kullanır)

## Bağımlılıklar (öne çıkanlar)

Express, MCP SDK, Zod, ioredis, mssql/pg/mongo, OpenAI, AWS S3, n8n-core (ağır, opsiyonel plugin'ler için).

**Not:** `@sentry/node` dependency'de yok; `SENTRY_DSN` kodu hollow import.
