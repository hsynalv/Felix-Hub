# Platform Değerlendirmesi

## Genel resim

mcp-hub bir **Express tabanlı AI-agent tool platformu**dur. REST API, MCP HTTP/STDIO, plugin sistemi, policy/onay mekanizması, audit, jobs, persistence, settings UI ve React frontend aynı çatıya alınmış.

Bu bir "deneysel script koleksiyonu" değil; **ürünleşmeye çalışan ciddi bir platform**.

---

## En güçlü taraflar

### 1. Mimari niyet net
`core/server.js` → `core/plugins.js` → `core/tool-registry.js` hattı anlaşılır. Plugin register, tool çağrısı, MCP gateway ve chat orchestrator aynı registry'yi paylaşıyor.

### 2. Plugin yaklaşımı doğru yönde
Tool manifest, endpoint listesi, auth scope, audit ve OpenAPI üretimi düşünülmüş. `plugin.meta.json` + `validate:plugins` scripti mevcut.

### 3. Güvenlik refleksleri var
Auth scope, policy guardrail, approval flow, shell allowlist, path/database güvenliği, Telegram allowlist gibi konular kodda yer alıyor — uygulama tutarlılığı ayrı konu (bkz. [security.md](./security.md)).

### 4. Test altyapısı pragmatik
Vitest + fork pool, core için %85 coverage threshold, plugin integration testleri exclude edilip manuel pakete alınmış. Aktif suite yeşil.

### 5. Step 2 özellikleri kodda mevcut
Settings API (şifreli MSSQL overlay), Telegram bot/webhook, Obsidian hub + community plugin, voice hooks (Web Speech API), chat orchestrator.

---

## En büyük risk: "çok hızlı büyümüş platform"

İki nesil mimari aynı anda yaşıyor:

| Eski (aktif) | Yeni (kısmen ölü) |
|--------------|-------------------|
| `core/plugins.js` | `core/registry/` |
| `core/tool-registry.js` | `core/tools/tool.registry.js` |
| `core/jobs.js` | `core/jobs/job.manager.js` |
| `core/audit.js` | `core/audit/index.js` (manager) |

**Sonuç soruları:**
- Hangi registry gerçek kaynak?
- Hangi audit API kullanılmalı?
- Hangi config kaynağı authoritative (env vs MSSQL settings)?

Kısa vadede çalışır; uzun vadede observability yanıltıcı (`registry.total === 0` → unhealthy), bakım maliyeti artar.

---

## Harici değerlendirme — cevap ve güncel durum

Aşağıdaki tablo, dışarıdan gelen yorumu mevcut kod taramasıyla karşılaştırır.

| Harici iddia | Güncel durum (2026-06-24) |
|--------------|---------------------------|
| "428 test geçti" | **~692 test**, ~51 dosya — `npm run test:run` (image-gen lazy client fix sonrası exit 0 hedefi) |
| "25 test file" | **~51 aktif** dosya (vitest exclude listesi hariç) |
| "Vitest exit 1, file-watcher EMFILE" | Bu ortamda **reprodüksiyon yok**; EMFILE ortama bağlı (macOS fd limit, watch leak). Risk kayıtlı — bkz. [testing.md](./testing.md) |
| "plugin.meta.json sadece birkaç plugin'de" | **35/35** mevcut; `validate:plugins` → 0 error. Kalite scaffold seviyesinde (boş `envVars`, generic description) |
| "slack, email, image-gen auth tutarsız" | **6E sonrası kısmen düzeltildi** — bu plugin'lerde `requireScope` var. Hâlâ **10 plugin** hiç `requireScope` kullanmıyor |
| "23 integration test exclude" | **Doğru** — vitest.config.js exclude listesi |
| "Frontend build tracked" | **Çözüldü** — `mcp-server/src/public/app/assets/` `.gitignore` içinde; tracked dosyalar index'ten çıkarılmalı |
| "config-schema vs open mode çelişkisi" | **Çözüldü** — bkz. [configuration.md](./configuration.md) |

### Harici yorumla tam uyum

> "Önümüzdeki birkaç sprint kalite/standardizasyon odaklı giderse sağlam bir MCP hub'a dönüşür."

Bu değerlendirme geçerli. Öncelik sırası [priorities.md](./priorities.md) ile uyumlu:

1. Config davranışını tek karara indir
2. Test suite güvenilirliği (EMFILE teardown, exclude stratejisi)
3. Registry/audit/tools tek kaynak
4. Plugin auth + meta kalitesi
5. Integration testleri mock'la veya ayrı CI job

---

## Kısa özet cümlesi

**Feature-rich ama standardizasyon borcu olan** bir platform. Temel yön doğru, ürünleşme potansiyeli var; kritik iş yeni özellik eklemekten çok **platform omurgasını sadeleştirmek**.
