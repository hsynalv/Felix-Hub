# Manuel Test Paketi

> CI dışında kalan env-heavy / integration testler için release öncesi checklist  
> Tahmini süre: **30–45 dakika**

## Ön koşullar

- `cd mcp-server && pnpm install`
- `.env` yapılandırılmış (en azından test edilecek plugin'ler için)
- `pnpm run test:run` aktif suite **yeşil**
- `pnpm run validate:plugins` **35/35 OK**

---

## 1. Core smoke (5 dk)

| # | Adım | Beklenen |
|---|------|----------|
| 1.1 | `pnpm run dev` — server başlat | Port 8787, sanity checks geçer |
| 1.2 | `GET /health` | `{ status: "ok" }` |
| 1.3 | `GET /whoami` + `Authorization: Bearer $HUB_READ_KEY` | scopes içerir |
| 1.4 | `GET /openapi.json` + read key | paths dolu |

---

## 2. MCP HTTP (5 dk)

Vitest: `tests/mcp/*.test.js` (aktif suite'te)

| # | Adım | Beklenen |
|---|------|----------|
| 2.1 | Key yokken `POST /mcp` tools/list (dev) | 200 |
| 2.2 | Key varken auth'sız istek | 401 |
| 2.3 | Read key ile tools/list | 200 + tools array |

---

## 3. Settings API (5 dk)

| # | Adım | Beklenen |
|---|------|----------|
| 3.1 | `GET /settings/` admin key olmadan | 401/403 |
| 3.2 | Admin key ile list | 200 |
| 3.3 | `GET /settings/env-catalog` admin key | Plugin gruplu env listesi |
| 3.4 | `PUT /settings/TEST_KEY` value set | 200 |
| 3.5 | `POST /settings/reload` | hot-reload keys uygulanır |
| 3.6 | UI `/settings` — bölüm navigasyonu | Genel, Görünüm, Proje, Entegrasyonlar, Bağlantılar, Gelişmiş |

---

## 4. Chat + multi-chat sidebar (10 dk)

**Ön koşul (kalıcı sohbet):** `HUB_PERSISTENCE_ENABLED=true`, `HUB_MSSQL_URL`, migration v2 (`chat_conversations`, `chat_messages`).

| # | Adım | Beklenen |
|---|------|----------|
| 4.1 | Frontend `pnpm run ui:dev` → `/chat` | Sol sidebar + composer görünür |
| 4.2 | **Yeni sohbet** | `POST /ui/chat/conversations` → thread listede |
| 4.3 | Mesaj gönder (write key önerilir) | SSE stream; `done` event'te `conversationId` |
| 4.4 | Sayfayı yenile (`?c=<uuid>`) | Mesajlar MSSQL'den yüklenir |
| 4.5 | Sohbet yeniden adlandır / sil | `PATCH` / `DELETE /ui/chat/conversations/:id` |
| 4.6 | Persistence kapalıyken CRUD | `503 persistence_unavailable`; stream client history ile çalışır |
| 4.7 | Mik/TTS butonları (Chrome) | Web Speech API |

**API smoke:**

```bash
# List
curl -s -H "Authorization: Bearer $HUB_READ_KEY" http://localhost:8787/ui/chat/conversations

# Create
curl -s -X POST -H "Authorization: Bearer $HUB_WRITE_KEY" -H "Content-Type: application/json" \
  -d '{"title":"Test"}' http://localhost:8787/ui/chat/conversations
```

---

## 5. Integration testleri

**CI'da otomatik (stable):**

```bash
cd mcp-server
pnpm run test:integration:stable
```

Kapsar: `plugin-loader`, `jobs-api`, `database`, `secrets`, `image-gen`, `notifications`, `shell`, `llm-router.contract`.

**Tam integration (nightly veya release öncesi):**

```bash
pnpm run test:integration
```

| Plugin / alan | Env gereksinimi |
|---------------|-----------------|
| notion | `NOTION_API_KEY`, DB ID'leri |
| rag | `OPENAI_API_KEY` veya Ollama |
| llm-router | LLM provider key |
| database | `MSSQL_CONNECTION_STRING` / PG / Mongo |
| secrets | persistence |
| shell | `SHELL_ALLOWLIST` |
| e2e / smoke | Server çalışır durumda |

---

## 6. Telegram (opsiyonel, 5 dk)

| # | Adım | Beklenen |
|---|------|----------|
| 6.1 | `TELEGRAM_POLLING=true` + bot token | Long polling log |
| 6.2 | Allowlisted chat'ten mesaj | Bot yanıt |
| 6.3 | Webhook + `TELEGRAM_WEBHOOK_SECRET` | Secret olmadan 403 |

---

## 7. Obsidian (opsiyonel, 5 dk)

| # | Adım | Beklenen |
|---|------|----------|
| 7.1 | `OBSIDIAN_EXPORT_ENABLED=true` | Brain export route |
| 7.2 | Community plugin vault'ta | Sync komutu çalışır |

---

## 8. Release gate

Bkz. [release-checklist.md](./release-checklist.md)

- [ ] Aktif CI suite yeşil (`pnpm run test:run`)
- [ ] Stable integration yeşil (`pnpm run test:integration:stable`)
- [ ] `validate:plugins` yeşil (`STRICT_PLUGIN_META=true`)
- [ ] Bu checklist'teki ilgili maddeler imzalandı
- [ ] Production `.env`: güçlü `HUB_*_KEY`, `ENABLE_MARKETPLACE=false` (default)

---

## Test katmanları (vitest)

| Katman | Komut | CI job |
|--------|-------|--------|
| Unit | `pnpm run test:run` | `ci.yml` |
| Integration stable | `pnpm run test:integration:stable` | `integration.yml` |
| Integration full | `pnpm run test:integration` | nightly schedule |
| Manuel | Bu doküman | release öncesi |
