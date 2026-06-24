# Faz 1 — Web UI ile LLM Bağlantısı

**Öncelik:** 1 / 5  
**Karmaşıklık:** XL  
**Durum:** Planlandı  
**Gate:** Faz 2 başlamadan önce bu belgedeki tüm kabul kriterleri karşılanmalı

---

## Hedef

mcp-hub'u yalnızca Cursor/MCP STDIO ile değil, **tarayıcı tabanlı premium Web UI** üzerinden herhangi bir LLM ile kullanılabilir hale getirmek. Kullanıcı `/ui` panelinden sohbet eder, hub tool'larını çağırır ve sonuçları görür.

---

## Mevcut Durum (Codebase Referansı)

| Dosya / Rota | Durum |
|--------------|-------|
| `mcp-server/src/public/ui/index.html` | Read-only MVP: tools, plugins, audit logs |
| `mcp-server/src/public/admin/index.html` | 20 plugin yönetim, işlem audit |
| `mcp-server/src/core/server.js` | `GET /ui`, `POST /ui/token`, localhost token |
| `mcp-server/src/plugins/brain/index.js` | `/brain/context`, memories — chat endpoint yok |
| `mcp-server/src/plugins/llm-router/index.js` | Model routing, maliyet metrikleri |
| `mcp-server/docs/integrations/custom-llm.md` | HTTP `/mcp` entegrasyon rehberi |

UI About sekmesi açıkça belirtiyor: *"This panel is intentionally read-only for the MVP."*

---

## Kapsam (In Scope)

### 1. Chat Arayüzü (`/ui`)

- Yeni **Chat** sekmesi: mesaj geçmişi, streaming yanıt (SSE veya chunked fetch)
- Model seçici: `llm-router` desteklediği modeller listesi
- System prompt slot'ları: `prompt-registry` veya `brain/context` ile context inject
- Tool çağrı görünürlüğü: agent tool call → sonuç kartları (read-only başlangıç, write onay akışı Faz 1 sonunda)

### 2. LLM Bağlantı Katmanı

- **Seçenek A (önerilen):** Sunucu tarafı proxy — UI → `POST /ui/chat` → `llm-router` + tool loop
- **Seçenek B:** UI doğrudan `/mcp` JSON-RPC (custom-llm.md pattern); CORS + auth header yönetimi UI'da

Başlangıç: Seçenek A — API key tarayıcıda minimum kalır, policy tek noktada uygulanır.

### 3. Premium UI Temeli

- Mevcut Tailwind dark theme (`slate-950`) korunur; tipografi ve spacing tutarlılığı
- Responsive layout: sidebar (sohbet listesi) + main (aktif sohbet) + opsiyonel tool panel
- `public/ui/` modüler JS: `api-client.js`, `chat.js`, `components.js` (inline script'ten ayrıştırma)
- `/admin` ile görsel dil uyumu (header, auth pill, token al)

### 4. Auth ve Güvenlik

- Mevcut `localStorage mcpHubApiKey` + `POST /ui/token` akışı korunur
- Chat endpoint'leri `requireScope("read")` minimum; tool execution `write` scope
- Destructive tool'lar için policy onay modal'ı (mevcut policy plugin entegrasyonu)

### 5. MCP HTTP Uyumu

- Harici LLM istemcileri için `/mcp` endpoint değişmeden çalışmaya devam eder
- Web UI, hub'un bir **birinci sınıf istemcisi** olur; STDIO/Cursor paralel kalır

---

## Kapsam Dışı (Out of Scope)

- React/Vue/SPA framework migration
- MSSQL'de sohbet geçmişi kalıcılığı (Faz 2)
- Obsidian export (Faz 3)
- UI'dan env düzenleme (Faz 4)
- Voice input, Telegram (future backlog)
- Tam multi-user SSO

---

## Görevler

### A. Backend — Chat API

| # | Görev | Dosya / Konum |
|---|-------|---------------|
| A1 | `POST /ui/chat` — mesaj + opsiyonel model, streaming yanıt | `core/server.js` veya yeni `core/ui-chat.js` |
| A2 | Tool loop orchestrator: LLM tool call → `callTool()` → sonuç LLM'e geri | `core/tool-registry.js` entegrasyonu |
| A3 | Context builder: `brain/context` + `prompt-registry` render hook | `plugins/brain/brain.context.js` |
| A4 | `GET /ui/chat/models` — llm-router model listesi | `plugins/llm-router/` |
| A5 | Session id (bellek içi veya Redis); restart'ta kaybolabilir (Faz 2'de MSSQL) | `core/redis.js` opsiyonel |

### B. Frontend — UI Genişletme

| # | Görev | Dosya / Konum |
|---|-------|---------------|
| B1 | Chat sekmesi HTML + mesaj bubble bileşenleri | `public/ui/index.html` |
| B2 | Streaming render (token-by-token veya chunk) | `public/ui/chat.js` |
| B3 | Tool call kartları (isim, args özeti, sonuç JSON collapse) | `public/ui/chat.js` |
| B4 | Model dropdown + system prompt preset seçici | `public/ui/chat.js` |
| B5 | Inline script refactor → ayrı modüller | `public/ui/*.js` |
| B6 | Loading / error / reconnect durumları | `public/ui/api-client.js` |

### C. UX / Premium Polish

| # | Görev |
|---|-------|
| C1 | Keyboard shortcut: Enter gönder, Shift+Enter yeni satır |
| C2 | Markdown render (basit: code block, bold, list) |
| C3 | Empty state + örnek prompt'lar |
| C4 | `/admin` ↔ `/ui` nav link tutarlılığı |

### D. Dokümantasyon

| # | Görev |
|---|-------|
| D1 | `docs/mcp-integration.md` — Web UI istemci bölümü |
| D2 | `getting-started.md` — `/ui` chat quick start |

---

## UI Teknoloji Stack Önerisi

| Katman | Seçim | Gerekçe |
|--------|-------|---------|
| Framework | **Vanilla JS (ES modules veya IIFE)** | `admin/`, `ui/`, `landing/` aynı pattern |
| CSS | **Tailwind CDN** | Mevcut; build yok |
| Markdown | **marked.js CDN** veya hafif custom | Tek dependency |
| Streaming | **fetch + ReadableStream** veya **EventSource** | Node Express SSE |
| State | In-memory + localStorage (session id, api key) | Faz 2'de MSSQL |

**React'e geçiş gerekmez** — Faz 1 XL zaten backend orchestrator + streaming UI içeriyor. React değerlendirmesi Step 2 future backlog'ta.

---

## Kabul Kriterleri

- [ ] `/ui` Chat sekmesinden en az bir LLM provider ile tam sohbet döngüsü tamamlanıyor
- [ ] LLM en az bir read-only MCP tool'u başarıyla çağırıp sonucu UI'da gösteriyor
- [ ] Streaming yanıt kullanıcıya canlı görünüyor (tam buffer sonrası değil)
- [ ] Auth: token olmadan chat 401/403; read key ile read tool'lar çalışıyor
- [ ] Write tool policy onay akışı en az bir destructive tool için çalışıyor
- [ ] `/mcp` HTTP ve STDIO mevcut davranışını koruyor (regresyon yok)
- [ ] Mobile viewport'ta chat kullanılabilir (responsive)
- [ ] Manual test checklist tamamlandı

---

## Manuel Test Kontrol Listesi

### Kurulum

- [ ] `cd mcp-server && npm start` — port 8787
- [ ] `OPENAI_API_KEY` veya yapılandırılmış LLM provider env set (değerleri loglama)
- [ ] `HUB_READ_KEY` / `HUB_WRITE_KEY` tanımlı

### Auth

- [ ] `http://localhost:8787/ui` açılıyor
- [ ] Localhost'tan "Token al" → bildirim + token localStorage'a kaydediliyor
- [ ] Token olmadan `/ui/chat` 403 dönüyor
- [ ] Geçersiz key ile chat hata mesajı gösteriyor

### Chat Temel

- [ ] Chat sekmesine geçiş sorunsuz
- [ ] "Merhaba" mesajı → streaming yanıt geliyor
- [ ] Model değiştirme farklı model adına yansıyor
- [ ] Uzun yanıtta scroll ve markdown code block düzgün render

### Tool Execution

- [ ] "Health durumunu kontrol et" → read tool çağrısı UI'da görünüyor
- [ ] Tool sonucu chat'e inject ediliyor
- [ ] Write tool (ör. `brain_remember`) policy onay modal'ı tetikliyor
- [ ] Onay reddedilince tool çalışmıyor, kullanıcıya mesaj gösteriliyor

### Regresyon

- [ ] Tools / Plugins / Logs sekmeleri önceki gibi çalışıyor
- [ ] `/admin` panel etkilenmedi
- [ ] `curl POST /mcp tools/list` hâlâ JSON-RPC dönüyor
- [ ] `bin/mcp-hub-stdio.js` Cursor bağlantısı çalışıyor

### UX

- [ ] Sayfa yenileme sonrası api key localStorage'dan yükleniyor
- [ ] Hata durumunda banner/toast gösteriliyor
- [ ] 768px altı ekranda layout kırılmıyor

---

## Bağımlılıklar

| Bağımlılık | Tip | Not |
|------------|-----|-----|
| `llm-router` plugin | Hard | Model listesi ve routing |
| `brain` plugin | Soft | Context injection |
| `prompt-registry` | Soft | System prompt composition |
| `core/auth.js` | Hard | Scope kontrolü |
| `core/tool-registry.js` | Hard | Tool execution loop |
| `core/policy` | Soft | Write onay |
| Redis | Opsiyonel | Session persistence |

**Önkoşul faz:** Yok — Step 2'nin ilk fazı.

**Sonraki faz:** [step2-phase-02-mssql.md](./step2-phase-02-mssql.md) — chat geçmişi kalıcılığı Faz 2'de ele alınır.

---

## Riskler ve Azaltma

| Risk | Azaltma |
|------|---------|
| Tool loop sonsuz döngü | Max iteration limit (ör. 10) |
| API key tarayıcıda sızıntı | Sunucu proxy; key UI'da tutulmaz |
| Streaming timeout | 60s idle + kullanıcı iptal butonu |
| LLM maliyet | llm-router metrikleri UI'da token/cost özeti |

---

## İlgili Belgeler

- [step2-master-plan.md](./step2-master-plan.md)
- [mcp-integration.md](../mcp-integration.md)
- [authentication.md](../authentication.md)
- [custom-llm.md](../../mcp-server/docs/integrations/custom-llm.md)
