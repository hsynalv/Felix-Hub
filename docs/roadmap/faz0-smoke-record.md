# Faz 0 — Manuel Smoke Kaydı

| Alan | Değer |
|------|-------|
| **Tarih** | 2026-06-24 |
| **Ortam** | macOS, Node 18+, `mcp-server/` |
| **Sonuç** | ✅ **PASS** — Faz 1 başlatılabilir |

---

## Checklist Sonuçları

| # | Test | Sonuç |
|---|------|-------|
| 1 | `npm start` — crash yok, port 8787 | ✅ |
| 2 | `GET /health` → 200 | ✅ |
| 3 | `GET /ui` → 200 | ✅ |
| 4 | `GET /admin` → 200 | ✅ |
| 5 | `POST /ui/token` (localhost) → token | ✅ |
| 6 | `GET /plugins` → 35 plugin | ✅ |
| 7 | `POST /mcp` `tools/list` → 163 tool | ✅ |
| 8 | `POST /mcp` `tools/call` (`llm_list_providers`) | ✅ |
| 9 | `bin/mcp-hub-stdio.js` initialize handshake | ✅ |
| 10 | `llm-router` plugin yüklü (ollama provider) | ✅ |

---

## Düzeltilen Bloklayıcı Bug'lar (Faz 0)

| Bug | Dosya | Düzeltme |
|-----|-------|----------|
| `database` plugin yüklenemiyordu (`requires` duplicate) | `plugins/database/index.js` | Yinelenen `export const requires` kaldırıldı |
| MCP HTTP `server.handleRequest is not a function` | `mcp/http-transport.js`, `mcp/gateway.js` | `handleMcpHttpMessage()` eklendi |
| MCP yanıtları REST envelope ile sarılıyordu | `core/server.js` | `/mcp` path için envelope bypass |

---

## Bilinen Borç (Faz 5'e ertelendi)

- Vitest: ~114/778 fail
- `image-gen` / `video-gen` tool registration (inputSchema)
- Legacy metadata plugin'ler
- `explanation` field uyarıları

---

## Onay

Faz 0 exit gate karşılandı. **Faz 1 (Web UI + LLM Chat)** başlatıldı.
