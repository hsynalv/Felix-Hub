# Plugin Geliştirme Kılavuzu

Bu kılavuz mcp-hub'a yeni plugin eklemek veya mevcut plugin'leri PLAN-V2 standartlarına uygun hale getirmek için pratik adımları içerir.

---

## Hızlı Başlangıç: Scaffold

```bash
cd mcp-server
npm run create-plugin my-plugin
```

Bu komut oluşturur:

```
src/plugins/my-plugin/
├── index.js           # Plugin ana dosyası
├── plugin.meta.json   # Metadata şablonu
└── README.md          # Dokümantasyon şablonu
```

**Script:** `mcp-server/scripts/create-plugin.js`

---

## Plugin Anatomisi

### Minimum sözleşme

```javascript
// src/plugins/my-plugin/index.js

export const name = "my-plugin";
export const version = "1.0.0";
export const description = "Kısa açıklama";
export const capabilities = ["read", "write"];

export const endpoints = [
  {
    path: "/my-plugin/resource",
    method: "GET",
    description: "Kaynak listele",
    scope: "read",
  },
];

export const tools = [
  {
    name: "my_plugin_action",
    description: "MCP tool açıklaması",
    tags: [ToolTags.READ_ONLY],
    inputSchema: {
      type: "object",
      properties: {
        param: { type: "string", description: "Parametre açıklaması" },
      },
      required: ["param"],
    },
    handler: async ({ param }, context) => {
      return { ok: true, data: { result: param } };
    },
  },
];

export function register(app) {
  const router = Router();
  router.get("/resource", requireScope("read"), handler);
  app.use("/my-plugin", router);
}
```

### createMetadata (önerilen)

Standart plugin'ler `metadata` export eder:

```javascript
import { createMetadata, PluginStatus, RiskLevel } from "../../core/plugins/index.js";

export const metadata = createMetadata({
  name: "my-plugin",
  version: "1.0.0",
  description: "...",
  status: PluginStatus.STABLE,
  riskLevel: RiskLevel.MEDIUM,
  capabilities: ["read", "write"],
  requires: ["MY_API_KEY"],  // env var isimleri
  endpoints: [ ... ],
  tags: ["category"],
});
```

---

## plugin.meta.json

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "status": "experimental",
  "owner": "your-github-username",
  "description": "Plugin açıklaması",
  "requiresAuth": true,
  "supportsJobs": false,
  "testLevel": "none",
  "resilience": {
    "retry": false,
    "timeout": 30000,
    "circuitBreaker": false
  },
  "security": {
    "scope": "read",
    "dangerousCombinations": [],
    "requiresApproval": false
  },
  "documentation": {
    "readme": true,
    "examples": false,
    "apiReference": false
  },
  "envVars": ["MY_API_KEY"]
}
```

Yükleme sırasında `validatePluginMeta()` bu dosyayı doğrular.

---

## Core Altyapı Kullanımı

### Auth

```javascript
import { requireScope } from "../../core/auth.js";

router.post("/action", requireScope("write"), async (req, res) => {
  // req.authScopes, req.actor kullanılabilir
});
```

Scope değerleri: `read`, `write`, `admin` (`danger` = admin).

### Hata yönetimi

```javascript
import { createPluginErrorHandler } from "../../core/error-standard.js";

const pluginError = createPluginErrorHandler("my-plugin");

try {
  // ...
} catch (err) {
  throw pluginError.wrap(err, "operationName");
}
```

### Audit

```javascript
import { auditLog, generateCorrelationId } from "../../core/audit/index.js";

await auditLog({
  plugin: "my-plugin",
  operation: "create_resource",
  actor: req.actor?.type || "anonymous",
  correlationId: req.requestId || generateCorrelationId(),
  allowed: true,
  success: true,
  durationMs: Date.now() - start,
  resource: resourceId,
});
```

Write MCP tool handler'larında da `auditLog()` çağırın.

### Validation

```javascript
import { validateBody } from "../../core/validate.js";
import { z } from "zod";

const schema = z.object({ name: z.string().min(1) });
router.post("/", requireScope("write"), validateBody(schema), handler);
```

### LLM ihtiyacı

Kendi LLM client'ınızı yazmayın:

```javascript
import { routeTask } from "../llm-router/index.js";

const result = await routeTask("code_review", prompt, { targetProvider: "openai" });
```

---

## MCP Tool Tasarımı

### ToolTags

```javascript
import { ToolTags } from "../../core/tool-registry.js";

// Salt okunur
tags: [ToolTags.READ_ONLY]

// Yazma
tags: [ToolTags.WRITE, ToolTags.LOCAL_FS]

// Tehlikeli
tags: [ToolTags.WRITE, ToolTags.DESTRUCTIVE, ToolTags.NEEDS_APPROVAL]
```

### inputSchema (parameters değil)

```javascript
inputSchema: {
  type: "object",
  properties: {
    path: { type: "string", description: "Dosya yolu" },
    explanation: {
      type: "string",
      description: "Bu tool'u neden çalıştırdığınız (Faz 3 standardı)"
    },
  },
  required: ["path"],
}
```

Write/destructive tool'larda `explanation` alanı zorunlu değil ama **şiddetle önerilir** — tool-registry uyarı verir.

### Handler dönüş formatı

```javascript
return {
  ok: true,
  data: { ... },
  meta: { correlationId: context.requestId },
};

// veya hata
return {
  ok: false,
  error: { code: "not_found", message: "Kaynak bulunamadı" },
};
```

---

## REST Route Mount

**Yanlış:**
```javascript
export function register(app) {
  console.log("[my-plugin] registered");  // route yok!
}
```

**Doğru:**
```javascript
export function register(app) {
  const router = Router();
  router.get("/health", requireScope("read"), healthHandler);
  router.get("/resource", requireScope("read"), listHandler);
  router.post("/resource", requireScope("write"), createHandler);
  app.use("/my-plugin", router);
}
```

Her plugin için `GET /<plugin>/health` endpoint'i ekleyin.

---

## Job Desteği (Opsiyonel)

Uzun süren işler için:

```javascript
import { registerJobRunner } from "../../core/jobs.js";

export function register(app) {
  registerJobRunner("my-plugin-long-task", async (job, updateProgress, log) => {
    updateProgress(10);
    log("Başladı");
    // ...
    updateProgress(100);
    return { result: "done" };
  });
}
```

İstemci: `POST /jobs { "type": "my-plugin-long-task", "payload": {} }`

`plugin.meta.json`: `"supportsJobs": true`

---

## Policy Entegrasyonu

Tehlikeli operasyonlar için policy plugin kuralları tanımlanabilir. Tool tag'lerinde `NEEDS_APPROVAL` kullanın.

REST write endpoint'leri otomatik olarak `policyGuardrailMiddleware`'den geçer.

---

## Test Yazma

Test dosyası: `mcp-server/tests/plugins/my-plugin.test.js`

```javascript
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createServer } from "../../src/core/server.js";

describe("my-plugin", () => {
  let app;

  beforeAll(async () => {
    app = await createServer();
  });

  it("GET /my-plugin/health returns ok", async () => {
    const res = await request(app).get("/my-plugin/health");
    expect(res.status).toBe(200);
  });
});
```

Coverage eşikleri (`vitest.config.js`):

| Alan | Eşik |
|------|------|
| `src/core/**/*.js` | %85 |
| `src/plugins/*/index.js` | %60–75 |

---

## Checklist (PR öncesi)

```
[ ] createMetadata() veya flat export'lar tutarlı
[ ] createPluginErrorHandler() tüm catch bloklarında
[ ] requireScope() tüm REST route'larda
[ ] auditLog() write operasyonlarında (REST + MCP)
[ ] ToolTags doğru atanmış
[ ] inputSchema kullanılıyor (parameters değil)
[ ] register(app) gerçek route mount ediyor
[ ] GET /<plugin>/health endpoint var
[ ] En az 1 entegrasyon testi
[ ] README'de curl örneği
[ ] plugin.meta.json güncel
[ ] Kendi callLLM() kopyası yok
[ ] .env.example'a yeni env var eklendi (gerekiyorsa)
[ ] Secret değerler loglanmıyor
```

---

## Strict Mod

Geliştirme sırasında plugin hatalarını erken yakalamak için:

```env
PLUGIN_STRICT_MODE=true
STRICT_PLUGIN_LOADING=true
```

Herhangi bir plugin yüklenemezse sunucu başlamaz.

---

## Dosya Yapısı Önerisi

```
src/plugins/my-plugin/
├── index.js              # register(), tools[], metadata
├── my-plugin.core.js     # İş mantığı (test edilebilir)
├── my-plugin.client.js   # Harici API client (varsa)
├── plugin.meta.json
├── README.md
└── presets.json          # Policy preset (opsiyonel)
```

---

## İlgili Belgeler

- [Plugin Genel Bakış](./overview.md)
- [Core 20 (PLAN-V2)](./core-20.md)
- [Core Bileşenler](../core-components.md)
- [API Referansı](../api-reference.md)
