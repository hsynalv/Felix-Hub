# Brain Memory UI (`/brain`)

Hub içinde brain belleklerini gezmek, filtrelemek ve markdown olarak düzenlemek için React sayfası.

## Önkoşullar

- `REDIS_URL` ayarlı ve Redis çalışıyor olmalı (brain plugin `requires: REDIS_URL`)
- Semantic arama (`POST /brain/recall`) için RAG + `OPENAI_API_KEY` önerilir
- Auth: Chat ile aynı — Settings’te API key veya `HUB_READ_KEY` / `HUB_WRITE_KEY`

## Sayfaya erişim

Production (hub SPA):

```
http://localhost:8787/brain
```

Geliştirme (Vite proxy):

```bash
cd mcp-server/frontend && npm run dev
# http://localhost:5173/brain
```

Sol menüde **Brain** bağlantısı veya doğrudan URL.

## Özellikler (Faz 3A MVP)

| Alan | Açıklama |
|------|----------|
| Sol panel | Metin arama, tip filtresi, tag, proje |
| Liste | Tip badge, önem, özet, tag’ler, tarih |
| Detay | Markdown önizleme + düzenleme, kaydet/sil |
| Semantic | “Semantic” toggle → `POST /brain/recall` |
| İlgili bellekler | Aynı `projectId` veya ortak tag |
| Üst şerit | `GET /brain/stats`, `GET /brain/profile` |
| Graph (3B) | Liste / Graph sekmesi — tag ve proje kenarları |
| Obsidian (3C) | Export açıksa “Obsidian’a aktar” butonu |

“Chat’te sor” bağlantısı `/chat?prompt=...` ile önceden doldurulmuş prompt açar.

## REST API (UI tarafından kullanılan)

| Method | Path | Scope |
|--------|------|-------|
| GET | `/brain/memories` | read |
| GET | `/brain/memories/:id` | read |
| POST | `/brain/memories` | write |
| PATCH | `/brain/memories/:id` | write |
| DELETE | `/brain/memories/:id` | write |
| POST | `/brain/recall` | read |
| GET | `/brain/projects` | read |
| GET | `/brain/stats` | read |
| GET | `/brain/profile` | read |
| GET | `/brain/obsidian/status` | read |
| POST | `/brain/obsidian/sync` | write |

Örnek:

```bash
export HUB_WRITE_KEY=your-key

curl -s -X POST http://localhost:8787/brain/memories \
  -H "Authorization: Bearer $HUB_WRITE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"fact","content":"Hub brain test","tags":["docs"]}'

curl -s -X POST http://localhost:8787/brain/recall \
  -H "Authorization: Bearer $HUB_READ_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"brain test","limit":5}'
```

## Obsidian dışa aktarım (opsiyonel)

Birincil UX hub içi `/brain` sayfasıdır. Obsidian yalnızca isteğe bağlı export:

```env
OBSIDIAN_EXPORT_ENABLED=true
OBSIDIAN_VAULT_PATH=/path/to/your/vault
```

Brain toolbar’daki sync butonu veya `POST /brain/obsidian/sync` tüm bellekleri `mcp-hub/memories/` altına yazar.

## Sorun giderme

| Belirti | Çözüm |
|---------|--------|
| Boş liste / 500 | Redis’i kontrol edin (`redis-cli ping`) |
| 401 banner | Settings → API key kaydedin |
| Semantic sonuç yok | RAG index; yeni bellekler otomatik `rag_index` alır |
| Obsidian butonu yok | `OBSIDIAN_EXPORT_ENABLED` ve vault path |

## İlgili dosyalar

- UI: `mcp-server/frontend/src/pages/BrainPage.tsx`
- API client: `mcp-server/frontend/src/lib/brain-api.ts`
- Backend: `mcp-server/src/plugins/brain/index.js`
