# Felix Hub

AI ajanları için **plugin-tabanlı araç köprüsü**. Tek bir hub üzerinden REST API, web paneli, MCP (Model Context Protocol) ve Telegram botu ile Cursor, Claude Desktop, n8n ve özel uygulamalarınıza entegrasyon sağlar.

> Repo klasör adı (`mcp-hub`) ve CLI adları (`mcp-hub-stdio`) geriye dönük uyumluluk için korunur. Ürün adı: **Felix Hub**.

## Ne var?

| Katman | Açıklama |
|--------|----------|
| **API** | Express tabanlı HTTP servisi (`mcp-server/`, port **8787**) |
| **Web UI** | React + Vite SPA — landing, chat, settings, admin, observability |
| **Pluginler** | GitHub, Notion, n8n, DB, RAG, brain, shell, … otomatik keşif |
| **MCP** | `/mcp` HTTP ve `mcp-hub-stdio` ile Cursor / Claude Desktop |
| **Kalıcılık** | MSSQL — kullanıcılar, sohbet geçmişi, şifreli settings |
| **Telegram** | Webhook + bildirim kanalı; hub’a mesajdan agent döngüsü |
| **Policy** | Onay merkezi, rate limit, audit log |

```text
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│ Web / Chat  │────▶│   Felix Hub API  │────▶│  Pluginler  │
│ Telegram    │     │  auth · policy   │     │ GitHub · …  │
└─────────────┘     └────────┬─────────┘     └─────────────┘
                             │
                    ┌────────┴────────┐
                    │ MSSQL settings  │
                    │ chat · users    │
                    └─────────────────┘
```

## Hızlı başlangıç (geliştirme)

Proje kökünde **pnpm** kullanılır (`mcp-server/pnpm-lock.yaml`).

```bash
cd mcp-server
pnpm install
pnpm install --dir frontend
cp .env.example .env
# .env → bootstrap değerleri (ENV-SETUP.md)
npm run hub:live
```

| Komut | Ne yapar |
|--------|----------|
| `npm run hub:live` | API watch + UI otomatik build (**günlük dev**) |
| `npm run dev:all` | API watch + Vite dev server (`:5173` proxy) |
| `npm run ui:build` | Production SPA build → `src/public/app` |

**Adresler (dev):**

| URL | Açıklama |
|-----|----------|
| http://localhost:8787/ | Public landing |
| http://localhost:8787/login | Oturum aç |
| http://localhost:8787/today | Ana panel (giriş sonrası) |
| http://localhost:8787/chat | Agent sohbet |
| http://localhost:8787/settings | Ayarlar & entegrasyonlar |
| http://localhost:8787/health | Sağlık kontrolü |

## Yapılandırma

İki katman vardır; ayrıntı: [`ENV-SETUP.md`](ENV-SETUP.md).

**1) Bootstrap — `mcp-server/.env` (sunucu açılmadan zorunlu)**

- `HUB_READ_KEY`, `HUB_WRITE_KEY`, `HUB_ADMIN_KEY`
- `HUB_MSSQL_URL`, `HUB_SETTINGS_MASTER_KEY`, `HUB_PERSISTENCE_ENABLED`
- İlk kullanıcı: `HUB_SEED_*` (bir kez)

**2) Entegrasyonlar — Settings UI veya `.env`**

- OpenAI, GitHub, Notion, n8n, **Telegram** (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, …)
- MSSQL’de şifreli saklanır; çoğu hot-reload
- Settings → Entegrasyonlar’da göz ikonu ile kayıtlı değerleri görüntüleme

Production’da ek olarak:

```env
NODE_ENV=production
CORS_ALLOWED_ORIGINS=https://senin-domainin.com
```

## Production (Docker)

Sunucuda **Docker** kullanın; lokal makine geliştirme içindir.

```bash
cd mcp-server
cp .env.example .env   # production değerleri
docker compose up -d --build
```

- Rehber: [`mcp-server/docs/DOCKER-DEPLOY.md`](mcp-server/docs/DOCKER-DEPLOY.md)
- Coolify: Base directory `mcp-server`, port **8787**, env **runtime-only**
- Telegram webhook: `https://<domain>/notifications/telegram/webhook`
- Secret döndürme: `node scripts/rotate-telegram-webhook.js`

## MCP & harici istemciler

```bash
# HTTP MCP (Bearer HUB_WRITE_KEY)
curl -H "Authorization: Bearer $HUB_WRITE_KEY" http://localhost:8787/tools

# stdio (Cursor / Claude Desktop)
npx mcp-hub-stdio
```

Kurulum notları: [`mcp-server/docs/integrations/`](mcp-server/docs/integrations/)

## Repo yapısı

```text
mcp-hub/
├── mcp-server/           # Ana uygulama (API + pluginler + SPA build çıktısı)
│   ├── frontend/         # React UI kaynakları
│   ├── src/plugins/      # Plugin modülleri
│   ├── src/core/         # Auth, chat, policy, persistence, …
│   ├── Dockerfile
│   └── docker-compose.yml
├── ENV-SETUP.md          # Ortam değişkenleri rehberi
└── README.md
```

## Test

```bash
cd mcp-server
npm run test:run
npm run validate:tools
```

## Dokümantasyon

| Konu | Dosya |
|------|--------|
| ENV / bootstrap | [ENV-SETUP.md](ENV-SETUP.md) |
| Docker deploy | [mcp-server/docs/DOCKER-DEPLOY.md](mcp-server/docs/DOCKER-DEPLOY.md) |
| Server API | [mcp-server/README.md](mcp-server/README.md) |
| Plugin geliştirme | [mcp-server/docs/plugin-development.md](mcp-server/docs/plugin-development.md) |

## Lisans

MIT
