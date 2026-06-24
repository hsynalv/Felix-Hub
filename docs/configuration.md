# Konfigürasyon

## Temel env değişkenleri

### Bootstrap (`.env` — sunucu öncesi zorunlu)

Entegrasyon anahtarları artık **Settings UI** üzerinden MSSQL'e yazılır. `.env` sadece bootstrap içerir:

```
PORT=8787
NODE_ENV=development

HUB_READ_KEY=
HUB_WRITE_KEY=
HUB_ADMIN_KEY=

HUB_PERSISTENCE_ENABLED=true
HUB_MSSQL_URL=
HUB_SETTINGS_MASTER_KEY=   # openssl rand -base64 32
```

Şablon: `mcp-server/.env.example`

### Auth
```
HUB_READ_KEY=    # scopes: read
HUB_WRITE_KEY=   # scopes: read, write
HUB_ADMIN_KEY=   # scopes: read, write, admin
HUB_AUTH_ENABLED=true   # MCP için ayrı flag (undocumented in old docs)
```

### Server
```
PORT=8787
NODE_ENV=development|production|test
```

### Settings (Step 2) — bootstrap only

```
HUB_SETTINGS_MASTER_KEY=   # 32-byte base64 — AES-256-GCM (sadece .env)
HUB_MSSQL_URL=             # persistence + settings store (sadece .env)
HUB_PERSISTENCE_ENABLED=true
```

Diğer tüm anahtarlar (OpenAI, Notion, Redis, …) → **Settings UI** veya `PUT /settings/:key`. Katalog: `GET /settings/env-catalog`.

### Telegram (UI'dan ayarla)
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=   # webhook açıksa zorunlu tutulmalı
TELEGRAM_ALLOWED_CHAT_IDS=
TELEGRAM_NOTIFY_UI_TOKEN=false
```

### Obsidian
```
OBSIDIAN_EXPORT_ENABLED=
OBSIDIAN_VAULT_PATH=
```

### Ollama (RAG + chat fallback)
```
OLLAMA_BASE_URL=
OLLAMA_MODEL=
OLLAMA_EMBEDDING_MODEL=
```

### Strict mode
```
STRICT_PLUGIN_LOADING=false
STRICT_PLUGIN_META=false
STRICT_TOOL_SCHEMA=false
```

---

## Auth davranışı (config-schema + open mode)

**Durum: çözüldü** (TD-2 kapalı)

### Mevcut davranış

[`config-schema.js`](../mcp-server/src/core/config-schema.js):

- `HUB_READ_KEY`, `HUB_WRITE_KEY`, `HUB_ADMIN_KEY` → `.default("")` (boş string geçerli)
- `NOTION_API_KEY` → `.default("")` (integration key Settings UI'dan gelir)

[`auth.js`](../mcp-server/src/core/auth.js):

- Üç key de boşsa → **open mode** (dev-friendly), startup'ta uyarı

### Ortam kuralları

| Ortam | Davranış |
|-------|----------|
| `NODE_ENV=development` | Key optional → open mode OK, startup warn |
| `NODE_ENV=test` | Test key'leri veya mock auth |
| `NODE_ENV=production` | `validateProductionAuth()` — üç key zorunlu, weak key block (min 16 char, `dev`/`test` vb. yasak) |

Placeholder key (`dev`, `test`) artık production'da reddedilir; development'ta open mode veya gerçek key kullanılmalı.

---

## Hot reload vs restart

`effective-config.js` hot-reload keys (örnek):
- LLM provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, ...)
- Redis, MSSQL connection
- Telegram webhook config
- Notion DB ID'leri

Restart-required keys:
- `PORT`, `HUB_*_KEY`, bind address

Settings UI'dan değişiklik → `POST /settings/reload` veya restart.

---

## Eksik .env.example

`mcp-server/.env.example` bootstrap-only şablon içerir. Entegrasyon anahtarları için Settings UI kullan.

---

## MCP vs REST auth ayrımı

| Kanal | Kontrol |
|-------|---------|
| REST | `HUB_*_KEY` → `requireScope()` |
| MCP HTTP | `HUB_AUTH_ENABLED=true` + token |
| MCP STDIO | Process-level (parent process) |

**Production:** Her iki kanal da aynı key setini kullanmalı; tek flag ile yönetilmeli.

---

## Persistence

```
HUB_MSSQL_URL=           # settings store
DATABASE_MSSQL_URL=      # database plugin (ayrı)
```

MSSQL default: `TrustServerCertificate=true` — production'da CA varsa `false` yapılmalı.

---

## UI token

`POST /ui/token` — sadece localhost'tan issuance.
Token 6 haneli, 5 dk TTL, scope: read+write+admin.
`localStorage`'da saklanıyor (frontend).

---

## CORS ve bind

- CORS: `cors()` — origin kısıtı yok
- Bind: `0.0.0.0` — tüm interface'ler

Production: reverse proxy + `127.0.0.1` bind + restricted CORS.
