# MCP Hub — Ortam değişkenleri

## `.env` içinde kalması gerekenler (bootstrap)

Sunucu ayağa kalkmadan önce bilinmesi gereken değerler. Bunlar **Settings UI'dan değiştirilemez** (veya restart ister).

| Değişken | Açıklama |
|----------|----------|
| `PORT` | HTTP portu (varsayılan 8787) |
| `NODE_ENV` | `development` \| `production` \| `test` |
| `HUB_READ_KEY` | Read scope API anahtarı |
| `HUB_WRITE_KEY` | Write scope API anahtarı |
| `HUB_ADMIN_KEY` | Admin scope — Settings UI için |
| `HUB_PERSISTENCE_ENABLED` | `true` → MSSQL settings + chat history |
| `HUB_MSSQL_URL` | Hub persistence connection string |
| `HUB_SETTINGS_MASTER_KEY` | AES-256-GCM master key (32 byte, base64) |

Şablon: [`.env.example`](./.env.example)

## Arayüzden girilenler (Entegrasyonlar)

`POST /settings/:key` veya **Ayarlar → Entegrasyonlar** üzerinden MSSQL'e şifreli kaydedilir. Hot-reload destekli örnekler:

- `OPENAI_API_KEY`, `BRAIN_LLM_MODEL`, `BRAIN_LLM_URL`
- `GITHUB_TOKEN`
- `NOTION_API_KEY`, `NOTION_*_DB_ID`
- `N8N_BASE_URL`, `N8N_API_KEY`
- `REDIS_URL`
- `MSSQL_CONNECTION_STRING` (database plugin)
- `SLACK_BOT_TOKEN`, `TELEGRAM_*`
- Plugin env kataloğu: `GET /settings/env-catalog`

İlk kurulumda anahtarları UI'dan bir kez gir; sonra `.env`'de tutmana gerek yok.

## İlk kurulum

1. `.env.example` → `.env` kopyala, bootstrap değerlerini doldur
2. `npm run dev` — migration + persistence init
3. `/settings` → admin key ile giriş → Entegrasyonlar'dan anahtarları kaydet
4. **Bağlantıları yenile** veya ilgili plugin'i test et
