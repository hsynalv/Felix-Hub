# Operasyonlar

Jobs kuyruğu, audit logları, observability, Redis ve test süreçleri için pratik rehber.

---

## Job Kuyruğu

Uzun süren işler asenkron job olarak çalıştırılır (`mcp-server/src/core/jobs.js`).

### Yaşam döngüsü

```
queued → running → completed | failed | cancelled
```

### Nasıl çalışır

1. Plugin başlangıçta `registerJobRunner("job-type", async (job, updateProgress, log) => { ... })` çağırır.
2. İstemci `POST /jobs` ile `{ "type": "job-type", "payload": {} }` gönderir.
3. Sunucu job'u kuyruğa alır ve `setImmediate` ile arka planda çalıştırır.
4. İstemci `GET /jobs/:id` ile durumu izler; `GET /jobs/stats` ile özet alır.

### Depolama

| Mod | Koşul | Davranış |
|-----|-------|----------|
| **Bellek** | `REDIS_URL` tanımlı değil | Job'lar process belleğinde; tamamlanan job'lar ~1 saat sonra temizlenir |
| **Redis** | `REDIS_URL` tanımlı | Kalıcı kuyruk; başlangıçta yetim job recovery |

Redis başlatılamazsa otomatik olarak bellek moduna düşülür.

### Job API özeti

| Method | Path | Kapsam | Açıklama |
|--------|------|--------|----------|
| POST | `/jobs` | write | Job gönder (`202`) |
| GET | `/jobs` | read | Listele (`state`, `type`, `limit`) |
| GET | `/jobs/:id` | read | Detay |
| GET | `/jobs/stats` | read | İstatistik |

### Admin panel

`http://localhost:8787/admin` → **Jobs** sekmesi: istatistik kartları ve son job tablosu.

### İzleme ipuçları

- Job log sayısı yanıtta `logCount` olarak döner (tam loglar Redis modunda ayrı store'da).
- Prometheus metrikleri: `/observability/metrics` (`jobs_*` metrikleri).
- Correlation: istek header'ına `x-correlation-id` ekleyin; yanıtta echo edilir.

---

## Audit Logları

İki katmanlı audit sistemi vardır.

### 1. HTTP istek audit (`/audit/logs`, `/audit/stats`)

- **Middleware:** Her HTTP isteği loglanır (method, path, plugin, status, süre).
- **Depolama:** Bellekte son 1000 kayıt (ring buffer).
- **Dosya:** `AUDIT_LOG_FILE=true` ise `cache/audit.log` (JSON satırları).
- **Maskeleme:** Request body'deki password, token, secret alanları `[REDACTED]`.

Admin panel → **İstek logu** sekmesi bu veriyi kullanır.

### 2. İşlem audit (`/audit/operations`)

- **Core audit manager:** Plugin tool çağrıları, izin kararları, actor bilgisi.
- **Sink'ler:** `AUDIT_SINKS` ile yapılandırılır (`memory`, `file`).
- **Admin panel:** **İşlem audit** sekmesi — plugin/operation filtresi, satır detayında JSON.

### Yapılandırma

```env
AUDIT_LOG_FILE=false          # HTTP audit dosyaya
AUDIT_ENABLED=true            # Core audit manager
AUDIT_SINKS=memory            # veya memory,file
AUDIT_FILE_PATH=./data/audit.log
AUDIT_MEMORY_MAX_ENTRIES=1000
```

---

## Observability Plugin

Sağlık, metrik ve hata yüzeyi sağlar.

### Dashboard

`http://localhost:8787/observability/dashboard`

- Request latency ve error rate
- Plugin yükleme durumu
- Job kuyruk boyutu
- Bellek kullanımı

### Endpoint'ler

| Endpoint | Açıklama |
|----------|----------|
| `GET /observability/health` | Aggregate sağlık (`healthy` / `degraded`) |
| `GET /observability/health/detailed?refresh=true` | Bağımlılık bazlı detay |
| `GET /observability/metrics` | Prometheus scrape formatı |
| `GET /observability/errors` | Audit'ten son hatalar |

### Sentry (isteğe bağlı)

```env
SENTRY_DSN=https://...@sentry.io/...
```

`@sentry/node` paketi yüklüyse observability plugin ve global error handler Sentry'ye raporlar.

### Prometheus entegrasyonu

Scrape config örneği:

```yaml
scrape_configs:
  - job_name: mcp-hub
    static_configs:
      - targets: ['localhost:8787']
    metrics_path: /observability/metrics
    authorization:
      credentials: <HUB_READ_KEY>
```

Auth etkinse Bearer token gerekir.

---

## Redis (İsteğe Bağlı)

Redis **zorunlu değildir**. Tanımlanmazsa:

- Job kuyruğu bellek içi
- Pattern cache (github-pattern-analyzer) bellek içi veya devre dışı kalabilir
- RAG vector store varsayılan `memory`

Redis tanımlandığında (`REDIS_URL`):

- Job persistence ve orphan recovery
- Pattern cache TTL (`PATTERN_CACHE_TTL_DAYS`)
- Draft session TTL (`DRAFT_SESSION_TTL_HOURS`)
- İsteğe bağlı RAG vector store (`RAG_VECTOR_STORE_TYPE=redis`)

```env
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=mcp-hub:
REDIS_TTL_SECONDS=86400
```

Yerel Redis:

```bash
docker run -d -p 6379:6379 redis:7-alpine
```

---

## Testler

Testler `mcp-server` dizininde Vitest ile çalışır.

```bash
cd mcp-server

npm test          # Watch modu
npm run test:run  # Tek seferlik
npm run test:coverage  # Coverage raporu
```

Test dosyaları: `mcp-server/tests/**/*.{test,spec}.js`

### Coverage eşikleri (vitest.config.js)

| Alan | Eşik |
|------|------|
| `src/core/**/*.js` | %85 branches/functions/lines/statements |
| `src/plugins/*/index.js` | %60–75 (metriğe göre) |

### Güncel test durumu

Son çalıştırma (`npm run test:run`):

| Metrik | Değer |
|--------|-------|
| Test dosyaları | 48 (22 geçti, 26 başarısız) |
| Test case | 778 (664 geçti, 114 başarısız) |
| Süre | ~5 saniye |

Başarısız testlerin önemli bir kısmı plugin audit API uyumsuzluklarından kaynaklanıyor (ör. `workspace.test.js` — `auditEntry is not a function`). Core modüllerin büyük bölümü geçiyor; CI'da tam yeşil suite için bu başarısızlıkların giderilmesi gerekir.

### Lint ve format

```bash
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

---

## Production Kontrol Listesi

- [ ] `HUB_READ_KEY`, `HUB_WRITE_KEY`, `HUB_ADMIN_KEY` güçlü rastgele değerler
- [ ] `NODE_ENV=production`
- [ ] `REQUIRE_PROJECT_HEADERS=true` (multi-tenant)
- [ ] Redis (`REDIS_URL`) — job persistence için
- [ ] `AUDIT_LOG_FILE=true` veya `AUDIT_SINKS=memory,file`
- [ ] `SENTRY_DSN` — hata takibi
- [ ] Prometheus scrape `/observability/metrics`
- [ ] Reverse proxy + TLS (nginx, Caddy vb.)

---

## Sorun Giderme

| Belirti | Olası neden | Çözüm |
|---------|-------------|-------|
| `401 unauthorized` | Auth etkin, token yok | `Authorization: Bearer` header ekle |
| `job_type_not_supported` | Runner kayıtlı değil | İlgili plugin'in yüklendiğini kontrol et |
| Job kayboluyor (restart) | Redis yok | `REDIS_URL` tanımla |
| Admin panel boş | Token eksik | **Token al** veya HUB_READ_KEY kaydet |
| Config validation failed | Zorunlu env eksik | [configuration.md](./configuration.md) |

Log seviyesini artırmak için: `LOG_LEVEL=DEBUG` veya `DEBUG=true`.
