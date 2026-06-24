# API Referansı

mcp-hub REST API'si Express üzerinde çalışır. Plugin endpoint'leri otomatik keşfedilir ve `/openapi.json` ile birleştirilir.

**Base URL:** `http://localhost:8787` (varsayılan `PORT`)

## Kimlik Doğrulama

Auth etkinse (`HUB_*` anahtarları tanımlı):

```
Authorization: Bearer <HUB_READ_KEY|HUB_WRITE_KEY|HUB_ADMIN_KEY>
```

Alternatif: `x-hub-api-key: <anahtar>`

| Kapsam | Gerekli anahtar | Tipik kullanım |
|--------|-----------------|----------------|
| `read` | READ, WRITE veya ADMIN | GET listeleri, audit, health |
| `write` | WRITE veya ADMIN | POST job, onay |
| `admin` | ADMIN | Tehlikeli işlemler |

Auth kapalıysa (açık mod) korumalı endpoint'ler token istemez.

### Proje bağlamı header'ları

| Header | Açıklama |
|--------|----------|
| `x-project-id` | Proje kimliği |
| `x-env` | Ortam (ör. `development`, `production`) |
| `x-correlation-id` | İstek izleme ID (yoksa sunucu üretir) |

`REQUIRE_PROJECT_HEADERS=true` ise `x-project-id` ve `x-env` zorunludur.

---

## Response Envelope

Tüm JSON yanıtlar standart zarf formatına normalize edilir (`responseEnvelopeMiddleware`).

### Başarılı yanıt

```json
{
  "ok": true,
  "data": { },
  "meta": {
    "requestId": "req-lxyz-abc123"
  }
}
```

### Hata yanıtı

```json
{
  "ok": false,
  "error": {
    "code": "unauthorized",
    "message": "Authorization header required.",
    "details": {}
  },
  "meta": {
    "requestId": "req-lxyz-abc123"
  }
}
```

**Notlar:**

- Bazı core route'lar (ör. `/jobs` POST) zarfı doğrudan döner; middleware çift sarmalamayı önler.
- Response header: `x-correlation-id` / `x-request-id`
- HTTP status kodu anlamlıdır: `400` validation, `401` auth, `403` yetki, `404` bulunamadı, `429` rate limit, `500` sunucu hatası

---

## Core Endpoint'ler

### `GET /health`

Kimlik doğrulama gerekmez.

**Yanıt (`data`):**

```json
{
  "status": "ok",
  "auth": "enabled"
}
```

`auth`: `"enabled"` veya `"disabled"`

---

### `GET /whoami`

**Kapsam:** `read`

Mevcut auth ve proje bağlamını döner.

```json
{
  "auth": { "enabled": true, "scopes": ["read"] },
  "actor": { "type": "api_key", "scopes": ["read"] },
  "project": { "id": "default-project", "env": "default-env" }
}
```

---

### `GET /plugins`

**Kapsam:** `read`

Yüklü plugin manifest listesi.

---

### `GET /plugins/:name/manifest`

**Kapsam:** `read`

Tek plugin manifest. Bulunamazsa `404` + `plugin_not_found`.

---

### `GET /openapi.json`

**Kapsam:** `read`

Tüm plugin endpoint'lerinden üretilen OpenAPI 3.0.3 spec. Swagger UI veya kod üretimi için kullanılabilir.

**İçerik:**

- `info.title`: "AI-Hub API"
- `components.securitySchemes.bearerAuth`: Bearer token
- `paths`: Plugin manifest'lerindeki `endpoints` dizisinden türetilir

---

## Audit Endpoint'leri

### `GET /audit/logs`

**Kapsam:** `read`

HTTP istek audit logları (in-memory ring buffer, son 1000 kayıt).

**Query parametreleri:**

| Param | Tip | Açıklama |
|-------|-----|----------|
| `plugin` | string | Plugin adına göre filtre |
| `status` | string | HTTP status filtre |
| `limit` | number | Maks. kayıt (varsayılan 100) |

**Yanıt (`data`):**

```json
{
  "count": 42,
  "logs": [
    {
      "timestamp": "2026-06-24T...",
      "method": "GET",
      "path": "/plugins",
      "plugin": "core",
      "status": 200,
      "durationMs": 12
    }
  ]
}
```

---

### `GET /audit/stats`

**Kapsam:** `read`

Plugin ve status bazında aggregate istatistikler.

```json
{
  "stats": {
    "total": 1500,
    "errors": 3,
    "byPlugin": { "github": { "total": 200, "errors": 0 } }
  }
}
```

---

### `GET /audit/operations`

**Kapsam:** `read`

Core audit manager — plugin işlem kayıtları (tool çağrıları, izin kararları).

**Query parametreleri:**

| Param | Varsayılan | Açıklama |
|-------|------------|----------|
| `plugin` | — | Plugin filtresi |
| `operation` | — | İşlem adı filtresi |
| `limit` | 100 | Maks. 500 |
| `offset` | 0 | Sayfalama |

```json
{
  "entries": [],
  "count": 0
}
```

---

## Jobs Endpoint'leri

Job durumları: `queued` → `running` → `completed` / `failed` / `cancelled`

Plugin'ler `registerJobRunner(type, handler)` ile job tipi kaydeder.

### `POST /jobs`

**Kapsam:** `write`

**Body:**

```json
{
  "type": "my-job-type",
  "payload": { "key": "value" }
}
```

**Başarı:** `202 Accepted`

```json
{
  "ok": true,
  "data": {
    "job": {
      "id": "uuid",
      "type": "my-job-type",
      "state": "queued",
      "context": { "projectId": "...", "env": "...", "user": null },
      "progress": 0,
      "createdAt": "...",
      "startedAt": null,
      "finishedAt": null
    }
  },
  "meta": { "requestId": "..." }
}
```

**Hatalar:**

| Kod | HTTP | Açıklama |
|-----|------|----------|
| `missing_type` | 400 | `type` eksik |
| `job_type_not_supported` | 400 | Kayıtlı runner yok |
| `job_submission_failed` | 500 | Sunucu hatası |

---

### `GET /jobs`

**Kapsam:** `read`

**Query:** `state`, `type`, `limit` (varsayılan 50)

```json
{
  "count": 10,
  "jobs": [ ]
}
```

---

### `GET /jobs/:id`

**Kapsam:** `read`

Tek job detayı. Bulunamazsa `404` + `job_not_found`.

```json
{
  "job": {
    "id": "...",
    "type": "...",
    "state": "completed",
    "progress": 100,
    "result": {},
    "error": null
  }
}
```

---

### `GET /jobs/stats`

**Kapsam:** `read`

```json
{
  "ok": true,
  "stats": {
    "total": 25,
    "queued": 1,
    "running": 2,
    "completed": 20,
    "failed": 1,
    "cancelled": 1
  }
}
```

---

## Onay (Approvals) Endpoint'leri

Policy motoru tehlikeli tool çağrılarını onaya alır.

### `GET /approvals/pending`

**Kapsam:** `read`

Bekleyen onay istekleri.

```json
{
  "ok": true,
  "data": {
    "count": 1,
    "approvals": [
      {
        "id": "approval-uuid",
        "toolName": "shell_execute",
        "status": "pending"
      }
    ]
  }
}
```

Policy sistemi yoksa `503` + `policy_unavailable`.

---

### `POST /approve`

**Kapsam:** `write`

**Body:**

```json
{
  "approval_id": "approval-uuid"
}
```

Onay verir ve ilgili tool'u çalıştırır.

**Başarı:**

```json
{
  "ok": true,
  "data": {
    "approval": {
      "id": "...",
      "status": "approved",
      "executedAt": "2026-06-24T..."
    },
    "result": {}
  }
}
```

**Hatalar:** `missing_approval_id`, `approval_not_found`, `approval_already_processed`, `execution_failed`

---

## UI Token

### `POST /ui/token`

Kimlik doğrulama gerekmez, **yalnızca localhost** (`127.0.0.1`, `::1`).

Kısa ömürlü 6 haneli UI kodu üretir.

```json
{
  "ok": true,
  "data": {
    "token": "123456",
    "expiresAt": "...",
    "ttlMs": 300000,
    "delivery": "notification"
  },
  "meta": { "requestId": "..." }
}
```

---

## MCP Gateway

### `ALL /mcp`

MCP HTTP transport endpoint. Cursor / Claude Desktop MCP istemcileri bu yolu kullanır.

---

## Statik Paneller

| Path | Auth | Açıklama |
|------|------|----------|
| `/ui` | Panel içi token | Web dashboard |
| `/admin` | Panel içi token | 20 plugin admin |
| `/` | Hayır | Landing page |
| `/observability/dashboard` | `read` | Observability plugin dashboard |

---

## Observability Plugin (Özet)

Core audit endpoint'lerine ek olarak observability plugin şunları sağlar:

| Endpoint | Kapsam | Açıklama |
|----------|--------|----------|
| `GET /observability/health` | read | Tüm plugin'lerin aggregate sağlığı |
| `GET /observability/health/detailed` | read | Bağımlılıklı detaylı health |
| `GET /observability/metrics` | read | Prometheus format metrikler |
| `GET /observability/errors` | read | Son hatalar (audit'ten) |
| `GET /observability/dashboard` | read | Web dashboard |

Detay: [operations.md](./operations.md)

---

## Örnek İstekler

```bash
# Sağlık (auth yok)
curl http://localhost:8787/health

# Plugin listesi
curl -H "Authorization: Bearer $HUB_READ_KEY" \
  http://localhost:8787/plugins

# OpenAPI spec
curl -H "Authorization: Bearer $HUB_READ_KEY" \
  http://localhost:8787/openapi.json -o openapi.json

# Job oluştur
curl -X POST http://localhost:8787/jobs \
  -H "Authorization: Bearer $HUB_WRITE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"example","payload":{}}'

# Bekleyen onaylar
curl -H "Authorization: Bearer $HUB_READ_KEY" \
  http://localhost:8787/approvals/pending
```

Plugin-spesifik endpoint'ler için `/openapi.json` veya ilgili plugin README dosyalarına bakın.
