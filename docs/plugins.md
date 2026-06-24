# Plugin Uyumluluk Matrisi

## Özet

| Metrik | Değer |
|--------|-------|
| Toplam plugin | 35 |
| `plugin.meta.json` | 35/35 ✅ |
| `validate:plugins` | 0 error, 0 warning |
| `requireScope` kullanan | 25/35 |
| `requireScope` kullanmayan | **10/35** ❌ |
| `GET /<plugin>/health` | 21/35 (14 eksik) |

---

## requireScope kullanmayan plugin'ler (auth gap)

| Plugin | Risk seviyesi |
|--------|---------------|
| notion | 🔴 Critical — CRUD |
| github | 🔴 Critical — PR/branch |
| llm-router | 🔴 Critical — LLM spend |
| local-sidecar | 🔴 Critical — filesystem |
| n8n | 🔴 Critical — workflow execute |
| n8n-credentials | 🟠 High — credentials |
| project-orchestrator | 🔴 Critical — repo/PR |
| repo-intelligence | 🟡 Medium |
| file-watcher | 🟡 Medium |
| tests | 🟡 Medium |

---

## requireScope kullanan plugin'ler (25)

brain, code-review, database, docker, email, file-storage, git, github-pattern-analyzer, http, image-gen, marketplace, n8n-workflows, notifications, observability, openapi, policy, projects, prompt-registry, rag, secrets, shell, slack, tech-detector, video-gen, workspace

**Not:** 6E ile slack, email, image-gen, video-gen, docker'a `requireScope` eklendi. Harici yorumdaki "auth tutarsız" iddiası kısmen güncel değil — asıl gap yukarıdaki 10 plugin.

---

## plugin.meta.json status dağılımı

| Status | Sayı |
|--------|------|
| stable | 4 (github, llm-router, notion, shell) |
| beta | 21 |
| experimental | 10 |

**Kalite sorunu:** Dosyalar var ama çoğu scaffold:
- Generic `description` ("brain plugin")
- Boş `envVars` (notifications → `TELEGRAM_*` eksik)
- Overview tablolarıyla uyumsuz (eski doc'lar çoğunu "stable" yazıyordu)

### Strict mode flag'leri
```
STRICT_PLUGIN_LOADING=false  (default)
STRICT_PLUGIN_META=false
STRICT_TOOL_SCHEMA=false
```

Production'da üçü de `true` olmalı.

---

## Health route eksik (14 plugin)

| Plugin |
|--------|
| github, llm-router, notion, shell |
| n8n-credentials, file-watcher, notifications |
| image-gen, local-sidecar, marketplace |
| docker, tests, slack, video-gen |

Plugin development checklist: `GET /<plugin>/health` önerilir.

---

## explanation field (write/destructive tools)

`STRICT_TOOL_SCHEMA=true` olmadan zorunlu değil.

**Eksik örnekler:** slack, docker ve diğer beta extension write tool'ları.

**Var örnek:** brain plugin write tool'ları.

---

## God plugin dosyaları

| Plugin | Satır (~) |
|--------|-----------|
| notion | 1940 |
| llm-router | 1368 |

Split önerisi: client / router / handler modülleri.

---

## Marketplace özel durumu

- `requireScope` var ama `npm install` çalıştırıyor
- Kurulan paketler `marketplace/installed/` altında; `plugins.js` loader'a otomatik bağlanmıyor
- Admin scope + `ENABLE_MARKETPLACE=false` default önerilir

---

## Tooling

```bash
npm run validate:plugins      # 35 meta validate
npm run scaffold:plugin-meta  # eksik meta üret
```

`create-plugin` script var (`scripts/create-plugin.js`) ama `package.json`'da register edilmemiş.
