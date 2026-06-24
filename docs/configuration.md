# Yapılandırma

mcp-hub, başlangıçta Zod şeması (`mcp-server/src/core/config-schema.js`) ile ortam değişkenlerini doğrular. Secret değerler loglarda maskelenir.

Kaynak dosyalar:

- `mcp-server/.env.example` — tam şablon
- `mcp-server/docs/environment-variables.md` — özet referans
- `mcp-server/src/core/config-schema.js` — doğrulama şeması
- `mcp-server/src/core/config.js` — env → config eşlemesi

## Zorunlu ve İsteğe Bağlı Özet

| Değişken | Zorunlu | Varsayılan | Not |
|----------|---------|------------|-----|
| `HUB_READ_KEY` | Şema: evet* | — | *Boş = açık mod (auth.js); şema min 1 karakter bekler |
| `HUB_WRITE_KEY` | Şema: evet* | — | |
| `HUB_ADMIN_KEY` | Şema: evet* | — | |
| `NOTION_API_KEY` | Şema: evet* | — | Notion plugin kullanılmıyorsa placeholder gerekebilir |
| Diğer tüm değişkenler | Hayır | Bölüme göre | |

---

## Sunucu

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `PORT` | Hayır | `8787` | HTTP dinleme portu |
| `NODE_ENV` | Hayır | `development` | `development`, `production`, `test` |
| `LOG_LEVEL` | Hayır | `INFO` | `DEBUG`, `INFO`, `WARN`, `ERROR` |
| `LOG_TO_CONSOLE` | Hayır | `true` | Konsol logu |
| `LOG_TO_FILE` | Hayır | `false` | Dosyaya log |
| `LOG_FILE_PATH` | Hayır | `./logs/mcp-server.log` | Log dosyası yolu |
| `LOG_MAX_SIZE_MB` | Hayır | `100` | Log rotasyon boyutu |
| `LOG_MAX_FILES` | Hayır | `5` | Saklanan log dosyası sayısı |
| `DEBUG` | Hayır | — | `true` / `1` ile debug modu |
| `DEBUG_LEVEL` | Hayır | `info` | Debug seviyesi |

---

## Kimlik Doğrulama ve Yetkilendirme

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `HUB_READ_KEY` | Şema: evet | — | Read scope API anahtarı |
| `HUB_WRITE_KEY` | Şema: evet | — | Read + write scope |
| `HUB_ADMIN_KEY` | Şema: evet | — | Read + write + admin scope |
| `UI_TOKEN_TTL_MS` | Hayır | `300000` (5 dk) | UI oturum kodu geçerlilik süresi |
| `OAUTH_INTROSPECTION_ENDPOINT` | Hayır | — | OAuth 2.1 token introspection URL |
| `OAUTH_INTROSPECTION_AUTH` | Hayır | — | Introspection Basic auth |

**Kapsam hiyerarşisi:** `read` < `write` < `admin` (`danger` = `admin`).

Header: `Authorization: Bearer <anahtar>` veya `x-hub-api-key`.

---

## Proje Bağlamı (Multi-tenant)

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `REQUIRE_PROJECT_HEADERS` | Hayır | `false` | `true` ise `x-project-id` ve `x-env` zorunlu |
| `DEFAULT_PROJECT_ID` | Hayır | `default-project` | Header yoksa kullanılan proje |
| `DEFAULT_ENV` | Hayır | `default-env` | Header yoksa kullanılan ortam |

---

## Plugin Yükleme

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `ENABLE_N8N_PLUGIN` | Hayır | `true` | n8n ana plugin |
| `ENABLE_N8N_CREDENTIALS` | Hayır | `true` | n8n-credentials plugin |
| `ENABLE_N8N_WORKFLOWS` | Hayır | `true` | n8n-workflows plugin |
| `STRICT_PLUGIN_LOADING` | Hayır | `false` | `true` ise plugin yükleme hatası sunucuyu durdurur |
| `PLUGIN_STRICT_MODE` | Hayır | `false` | Başarısız plugin'lerde katı mod |

---

## Audit

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `AUDIT_LOG_FILE` | Hayır | `false` | HTTP audit'i `cache/audit.log` dosyasına yaz |
| `AUDIT_ENABLED` | Hayır | `true` | Core audit manager |
| `AUDIT_SINKS` | Hayır | `memory` | Sink listesi (ör. `memory,file`) |
| `AUDIT_MEMORY_MAX_ENTRIES` | Hayır | `1000` | Bellekte tutulan kayıt sayısı |
| `AUDIT_FILE_PATH` | Hayır | `./data/audit.log` | Core audit dosya yolu |
| `AUDIT_FILE_MAX_SIZE_MB` | Hayır | `50` | Audit dosya boyut limiti |
| `AUDIT_SANITIZE_STRICT` | Hayır | `true` | Hassas alan maskeleme |
| `AUDIT_SENSITIVE_PATTERNS` | Hayır | — | Virgülle ayrılmış regex desenleri |

---

## Redis (İsteğe Bağlı)

Redis tanımlı değilse job kuyruğu ve pattern cache bellek içi modda çalışır.

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `REDIS_URL` | Hayır | — | Tanımlanırsa Redis etkin (`redis://localhost:6379`) |
| `REDIS_PREFIX` | Hayır | `mcp-hub:` | Key prefix |
| `REDIS_TTL_SECONDS` | Hayır | `86400` | Job store TTL |
| `PATTERN_CACHE_TTL_DAYS` | Hayır | `7` | Pattern cache süresi (gün) |
| `DRAFT_SESSION_TTL_HOURS` | Hayır | `1` | Draft oturum TTL (saat) |

---

## n8n

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `N8N_BASE_URL` | Hayır | `http://n8n:5678` | n8n sunucu URL |
| `N8N_API_BASE` | Hayır | `/api/v1` | REST API base path |
| `N8N_API_KEY` | Hayır* | — | *Credential/workflow yazma için gerekli |
| `ALLOW_N8N_WRITE` | Hayır | `false` | n8n yazma işlemleri |
| `CATALOG_CACHE_DIR` | Hayır | `./cache` | Node catalog cache dizini |
| `CATALOG_TTL_HOURS` | Hayır | `24` | Catalog cache TTL |
| `CREDENTIALS_TTL_MINUTES` | Hayır | `60` | Credential listesi cache |
| `WORKFLOWS_TTL_MINUTES` | Hayır | `10` | Workflow listesi cache |

---

## Notion

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `NOTION_API_KEY` | Şema: evet | — | Integration API key |
| `NOTION_ROOT_PAGE_ID` | Hayır | — | Varsayılan üst sayfa |
| `NOTION_PROJECTS_DB_ID` | Hayır | — | Projeler veritabanı |
| `NOTION_TASKS_DB_ID` | Hayır | — | Görevler veritabanı |

---

## GitHub

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `GITHUB_TOKEN` | Hayır | — | Token yoksa yalnızca public repo (60 req/saat) |
| `GITHUB_ANALYZE_REPO_COUNT` | Hayır | `5` | Pattern analyzer repo sayısı |
| `PATTERN_CONFIDENCE_THRESHOLD` | Hayır | `0.7` | Pattern kabul eşiği (0–1) |

---

## Slack

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `SLACK_BOT_TOKEN` | Hayır | — | Bot token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Hayır | — | İmza doğrulama (webhook) |

---

## HTTP Plugin

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `HTTP_ALLOWED_DOMAINS` | Hayır | — | Virgülle ayrılmış allowlist (`*.github.com`) |
| `HTTP_BLOCKED_DOMAINS` | Hayır | — | Her zaman engellenen domainler |
| `HTTP_MAX_RESPONSE_SIZE_KB` | Hayır | `512` | Maks. yanıt gövdesi |
| `HTTP_DEFAULT_TIMEOUT_MS` | Hayır | `10000` | İstek zaman aşımı |
| `HTTP_RATE_LIMIT_RPM` | Hayır | `60` | Domain başına dakika limiti |
| `HTTP_CACHE_TTL_SECONDS` | Hayır | `300` | GET cache TTL |

---

## OpenAPI Plugin

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `OPENAPI_CACHE_DIR` | Hayır | `./cache/openapi` | Spec cache dizini |

---

## Hub Persistence (Faz 2)

Hub-internal MSSQL şeması — **database plugin pool'undan ayrı** bağlantı kullanır.

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `HUB_PERSISTENCE_ENABLED` | Hayır | `false` | `true` ise hub schema migration + audit MSSQL sink |
| `HUB_MSSQL_URL` | Hayır* | — | *Persistence açıkken gerekli (veya `MSSQL_CONNECTION_STRING` fallback) |

Tablolar: `settings_encrypted`, `connection_profiles`, `audit_archive`, `memory_sync_state`, `hub_schema_version`.

`/health` yanıtında `persistence.status`: `disabled` | `healthy` | `degraded`.

---

## Veritabanı Plugin

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `PG_CONNECTION_STRING` | Hayır | — | PostgreSQL |
| `MSSQL_CONNECTION_STRING` | Hayır | — | Microsoft SQL Server |
| `MONGODB_URI` | Hayır | — | MongoDB |

---

## Dosya Depolama

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `FILE_STORAGE_LOCAL_ROOT` | Hayır | `./cache/files` (config.js) / `./storage` (.env.example) | Yerel kök dizin |
| `FILE_STORAGE_MAX_MB` | Hayır | `50` | Maks. dosya boyutu (MB) |
| `FILE_STORAGE_MAX_SIZE_BYTES` | Hayır | — | Alternatif byte limiti |
| `FILE_STORAGE_READONLY` | Hayır | `false` | Yazma işlemlerini engelle |
| `FILE_STORAGE_WORKSPACE_ISOLATION` | Hayır | `false` | Workspace alt dizinleri |
| `FILE_STORAGE_WORKSPACE_STRICT` | Hayır | `false` | workspaceId zorunlu |
| `AWS_ACCESS_KEY_ID` | Hayır | — | S3 erişimi |
| `AWS_SECRET_ACCESS_KEY` | Hayır | — | S3 secret |
| `AWS_REGION` | Hayır | — | AWS bölgesi |
| `S3_BUCKET_NAME` | Hayır | — | S3 bucket |
| `GOOGLE_DRIVE_CLIENT_ID` | Hayır | — | Google Drive |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Hayır | — | |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | Hayır | — | |

---

## LLM / Brain

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `OPENAI_API_KEY` | Hayır* | — | *Brain, RAG, llm-router, **Web UI Chat** için |
| `OPENAI_CHAT_MODEL` | Hayır | `gpt-4o-mini` | Web UI chat varsayılan model |
| `ANTHROPIC_API_KEY` | Hayır | — | Anthropic entegrasyonu |
| `BRAIN_LLM_URL` | Hayır | `https://api.openai.com/v1` | OpenAI uyumlu base URL |
| `BRAIN_LLM_MODEL` | Hayır | `gpt-4o-mini` | Varsayılan model |

---

## Workspace ve Git

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `WORKSPACE_PATH` | Hayır | `./workspace` | Proje workspace kökü |
| `WORKSPACE_BASE` | Hayır | `~/Projects` | tech-detector / git path doğrulama |
| `GIT_DEFAULT_AUTHOR_NAME` | Hayır | `Jarvis` | Commit yazar adı |
| `GIT_DEFAULT_AUTHOR_EMAIL` | Hayır | `jarvis@localhost` | Commit yazar e-posta |

---

## RAG Plugin

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `RAG_VECTOR_STORE_TYPE` | Hayır | `memory` | `memory`, `redis`, `pinecone`, `weaviate` |
| `RAG_REDIS_URL` | Hayır | — | Redis vector store |
| `RAG_PINECONE_API_KEY` | Hayır | — | Pinecone |
| `RAG_PINECONE_INDEX` | Hayır | — | Pinecone index adı |
| `RAG_WEAVIATE_URL` | Hayır | — | Weaviate URL |
| `RAG_EMBEDDING_MODEL` | Hayır | `text-embedding-3-small` | Embedding modeli |
| `RAG_MAX_BATCH_SIZE` | Hayır | `100` | Toplu indeksleme limiti |

---

## Observability ve Sentry

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `SENTRY_DSN` | Hayır | — | Sentry hata takibi (`@sentry/node` gerekir) |

---

## Jobs

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `JOBS_ENABLED` | Hayır | `true` | Job sistemi |
| `JOBS_MAX_CONCURRENCY` | Hayır | — | Eşzamanlı job limiti |

---

## Test Plugin

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `TESTS_DEFAULT_TIMEOUT_MS` | Hayır | `60000` | Test çalıştırma timeout |
| `TESTS_DEFAULT_PATTERN` | Hayır | `**/*.test.js` | Test glob deseni |
| `TESTS_COVERAGE_DIR` | Hayır | `./coverage` | Coverage çıktı dizini |

---

## Project Orchestrator

| Değişken | Zorunlu | Varsayılan | Açıklama |
|----------|---------|------------|----------|
| `MCP_SERVER_URL` | Hayır | `http://localhost:8787` | MCP sunucu URL |
| `DEFAULT_TECH_STACK` | Hayır | `Node.js, Express` | Varsayılan tech stack |
| `PROJECT_AUTO_EXECUTE` | Hayır | `false` | İlk fazı otomatik çalıştır |

---

## Doğrulama Davranışı

1. **Fail-fast:** Zorunlu alan eksikse sunucu başlamadan çıkar.
2. **Tip kontrolü:** Port, TTL ve boolean değerler şemada doğrulanır.
3. **Maskelenmiş log:** Başlangıçta `logStartupConfig()` secret içeren alanları kısaltır.

Geliştirme için `.env.example` dosyasını kopyalayıp ihtiyaç duyduğunuz bölümleri doldurmanız yeterlidir; production'da tüm secret'ları güvenli bir secret manager üzerinden sağlayın.
