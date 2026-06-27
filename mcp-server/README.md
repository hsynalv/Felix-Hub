# Felix Hub — Server

`mcp-server/` altındaki Node.js uygulaması: HTTP API, plugin yükleyici, React SPA sunumu, MCP gateway, MSSQL persistence.

## Kurulum

```bash
pnpm install
pnpm install --dir frontend
cp .env.example .env
```

Bootstrap değerleri için: [`../../ENV-SETUP.md`](../../ENV-SETUP.md)

## Çalıştırma

| Komut | Kullanım |
|--------|----------|
| `npm run hub:live` | **Geliştirme** — `node --watch` + UI `build:watch` |
| `npm run dev` | Yalnızca API (watch) |
| `npm run ui:build` | SPA production build |
| `npm start` | API (UI önceden build edilmiş olmalı) |

Port varsayılanı: **8787**

## Production

```bash
docker compose up -d --build
```

- [`docs/DOCKER-DEPLOY.md`](docs/DOCKER-DEPLOY.md) — Docker / Coolify
- [`docs/PM2-DEPLOY.md`](docs/PM2-DEPLOY.md) — legacy; production için Docker tercih edin

## Kimlik doğrulama

Öncelik sırası:

1. **Session cookie** (`hub_session`) — web UI girişi
2. **Bearer** `HUB_READ_KEY` / `HUB_WRITE_KEY` / `HUB_ADMIN_KEY`
3. Geliştirme: `POST /ui/token` (localhost, kısa ömürlü read kodu)

Kullanıcı oturumu açıkken sohbet ve settings **tenant namespace** (`user:<id>`) ile izole edilir.

## Önemli HTTP yolları

| Yol | Açıklama |
|-----|----------|
| `GET /health` | Sağlık |
| `GET /` | SPA — landing |
| `GET /today`, `/chat`, `/settings`, … | SPA — korumalı sayfalar |
| `POST /auth/login`, `/auth/register` | Oturum |
| `GET /ui/chat/*` | Chat API (sohbet, modeller) |
| `GET/PUT /settings/*` | Şifreli ayarlar (`/:key/reveal` ile görüntüleme) |
| `POST /notifications/telegram/webhook` | Telegram bot (public + secret header) |
| `POST /notifications/send` | Native / Telegram bildirim |
| `ALL /mcp` | MCP HTTP transport |
| `GET /admin` | Eski admin SPA (hâlâ mevcut) |

## Pluginler

`src/plugins/<ad>/index.js` — otomatik keşif. Her plugin export eder:

```javascript
export const name = "my-plugin";
export const version = "1.0.0";
export async function register(app) { /* routes + tools */ }
```

Entegrasyon env anahtarları: Settings → **Entegrasyonlar** veya `plugin.meta.json` + `plugin-env-catalog`.

## Ortam değişkenleri (özet)

| Değişken | Açıklama |
|----------|----------|
| `PORT` | HTTP port (8787) |
| `HUB_*_KEY` | API anahtarları (bootstrap) |
| `HUB_MSSQL_URL` | Hub persistence |
| `HUB_SETTINGS_MASTER_KEY` | Settings şifreleme |
| `CORS_ALLOWED_ORIGINS` | Production zorunlu |
| `TELEGRAM_*` | Bot & webhook (Settings’te de tutulabilir) |

Tam liste: [`../../ENV-SETUP.md`](../../ENV-SETUP.md)

## Test

```bash
npm run test:run
npm run test:integration:stable
npm run validate:tools
```

## İlgili dosyalar

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — mimari notlar
- [`docs/codebase-map.md`](docs/codebase-map.md) — kod haritası
- [`frontend/README.md`](frontend/README.md) — UI geliştirme
