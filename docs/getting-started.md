# Başlangıç Kılavuzu

mcp-hub, AI ajanları için plugin tabanlı bir HTTP servisidir. REST API ve MCP (Model Context Protocol) üzerinden Cursor, Claude Desktop, n8n ve özel LLM uygulamalarına entegrasyon sağlar.

## Gereksinimler

- Node.js >= 18
- npm >= 9
- Git

Redis ve harici servisler (Notion, GitHub, n8n vb.) isteğe bağlıdır; temel sunucu bunlar olmadan da ayağa kalkabilir.

## Kurulum

```bash
git clone https://github.com/hsynalv/mcp-hub.git
cd mcp-hub/mcp-server

npm install
cp .env.example .env
```

`.env` dosyasını düzenleyin. **Gerçek `.env` dosyanızı repoya commit etmeyin.**

## Ortam Değişkenleri (Minimum)

`.env.example` dosyası tüm değişkenleri şablon olarak içerir. İlk kurulum için en az şunları ayarlayın:

### Kimlik doğrulama (önerilen)

`.env.example` auth bölümünde üç anahtar tanımlıdır:

```env
HUB_READ_KEY=dev-read-key
HUB_WRITE_KEY=dev-write-key
HUB_ADMIN_KEY=dev-admin-key
```

| Anahtar | Kapsam |
|---------|--------|
| `HUB_READ_KEY` | `read` — listeleme, arama, catalog |
| `HUB_WRITE_KEY` | `read` + `write` — oluşturma, güncelleme |
| `HUB_ADMIN_KEY` | `read` + `write` + `admin` — tüm işlemler |

Üç anahtar da boş bırakılırsa sunucu **açık mod** (auth kapalı) çalışır — yalnızca yerel geliştirme için uygundur. Not: `config-schema.js` başlangıçta anahtarları zorunlu sayabilir; sorun yaşarsanız geliştirme için placeholder değerler kullanın.

### Sunucu

```env
PORT=8787
NODE_ENV=development
```

Diğer plugin entegrasyonları (Notion, GitHub, n8n, OpenAI vb.) ihtiyaç duyduğunuz plugin'ler için `.env.example` içindeki ilgili bölümleri doldurun. Detaylı liste: [configuration.md](./configuration.md).

## Sunucuyu Başlatma

```bash
npm run dev     # Geliştirme — dosya değişince otomatik yeniden başlar
npm start       # Production
```

Başarılı başlangıçta konsolda sanitize edilmiş konfigürasyon özeti görünür (secret değerler maskelenir).

## Sağlık Kontrolü

Sunucu ayaktayken:

```bash
curl http://localhost:8787/health
```

Örnek yanıt (response envelope uygulanır):

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "auth": "enabled"
  },
  "meta": {
    "requestId": "req-..."
  }
}
```

Auth etkinse plugin listesi için Bearer token gerekir:

```bash
curl -H "Authorization: Bearer dev-read-key" http://localhost:8787/plugins
```

## Web Arayüzü (React SPA)

Tek birleşik panel: Vite + React + Tailwind. Production build `mcp-server/src/public/app/` dizinine yazılır; Express aynı porttan (`8787`) API + SPA sunar.

### Kurulum ve geliştirme

```bash
cd mcp-server
npm install          # kök bağımlılıklar
npm install --prefix frontend

npm run ui:build     # production build
npm start            # API + SPA birlikte

npm run ui:dev       # yalnızca Vite (5173), API proxy → 8787
npm run dev:all      # API + Vite eşzamanlı (concurrently)
```

### Route haritası

| Route | İçerik |
|-------|--------|
| `/` | Dashboard — health, plugin/tool sayıları |
| `/chat` | LLM streaming sohbet + MCP tool loop |
| `/tools` | Tool registry |
| `/plugins` | Plugin grid |
| `/audit` | Audit archive + request logs |
| `/admin` | Jobs, policy onay kuyruğu |
| `/observability` | Metrics, errors, plugin health |
| `/settings` | API key, tema |

**Legacy yönlendirme:** `/ui` → `/chat`, `/observability/dashboard` → `/observability`

Adres: `http://localhost:8787/` (veya geliştirmede `http://localhost:5173/`)

### Chat hızlı başlangıç

1. `.env` içinde `OPENAI_API_KEY` (veya Ollama) yapılandırın.
2. `npm run ui:build && npm start` — veya `npm run dev:all`.
3. `http://localhost:8787/chat` açın.
4. Üst bardan **Token** (localhost) veya HUB anahtarını **Save** edin.
5. Örnek: *Merhaba* veya *Policy kurallarını listele*.

Model seçici, tool kartları ve policy onay modal'ı Chat sayfasında yer alır. Detay: [mcp-integration.md](./mcp-integration.md#web-ui-chat-istemcisi-faz-1).

### UI kimlik doğrulama

Auth etkinse panel API çağrıları için `read` kapsamı gerekir. Uzun ömürlü HUB anahtarını tarayıcıya yazmak yerine kısa ömürlü UI kodu kullanılabilir:

1. `/chat` veya `/settings` sayfasını açın.
2. **Token** ile `POST /ui/token` çağrılır (yalnızca localhost).
3. 6 haneli kodu kaydedin; panel `Authorization: Bearer <kod>` kullanır (`localStorage mcpHubApiKey`).

UI kodları yalnızca `read` kapsamı verir. Süre varsayılan 5 dakikadır (`UI_TOKEN_TTL_MS` ile değiştirilebilir).

## Sonraki Adımlar

- Tüm env değişkenleri: [configuration.md](./configuration.md)
- REST API: [api-reference.md](./api-reference.md)
- Jobs, audit, testler: [operations.md](./operations.md)
- Plugin geliştirme: [mcp-server/docs/plugin-development.md](../mcp-server/docs/plugin-development.md)
- Mimari: [mcp-server/ARCHITECTURE.md](../mcp-server/ARCHITECTURE.md)
