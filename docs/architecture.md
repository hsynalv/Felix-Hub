# Mimari

mcp-hub, Express tabanlı bir HTTP sunucusu üzerinde plugin keşfi, merkezi tool registry ve çift transport (REST + MCP) ile çalışan modüler bir AI agent platformudur.

---

## Sistem Genel Bakış

```mermaid
flowchart TB
    subgraph Clients["İstemciler"]
        Cursor["Cursor / Claude Desktop"]
        REST["REST İstemcileri"]
        n8n["n8n / Otomasyon"]
        Admin["Admin / UI Panel"]
    end

    subgraph Transport["Transport Katmanı"]
        HTTP["Express HTTP :8787"]
        MCPHTTP["GET/POST /mcp"]
        STDIO["bin/mcp-hub-stdio.js"]
    end

    subgraph Core["Core Katman"]
        MW["Middleware Zinciri"]
        TR["tool-registry.js"]
        PL["plugins.js"]
        POL["policy-guard.js"]
        AUD["audit.js + audit.manager"]
        JOB["jobs.js"]
    end

    subgraph Plugins["35 Plugin"]
        P20["Core 20 (PLAN-V2)"]
        P15["Extension 15"]
    end

    Cursor --> STDIO
    Cursor --> MCPHTTP
    REST --> HTTP
    n8n --> HTTP
    Admin --> HTTP

    HTTP --> MW
    MCPHTTP --> TR
    STDIO --> TR

    MW --> PL
    MW --> POL
    MW --> AUD
    MW --> JOB

    PL --> P20
    PL --> P15
    P20 --> TR
    P15 --> TR
```

---

## Başlangıç Akışı

```mermaid
sequenceDiagram
    participant Index as index.js
    participant Sanity as sanity.js
    participant Server as server.js
    participant Plugins as plugins.js
    participant Registry as tool-registry.js

    Index->>Sanity: validateStartup()
    Index->>Server: createServer()
    Server->>Server: loadPresetsAtStartup()
    Server->>Registry: initializeToolHooks()
    Server->>Plugins: loadPlugins(app)
    loop Her plugin dizini
        Plugins->>Plugins: validatePluginMeta()
        Plugins->>Plugins: plugin.register(app)
        Plugins->>Registry: registerTool() × N
    end
    Server->>Index: app.listen(PORT)
```

**Giriş noktası:** `mcp-server/src/index.js`  
**Sunucu fabrikası:** `mcp-server/src/core/server.js`

---

## Middleware Zinciri

İstekler aşağıdaki sırayla işlenir (`createServer()` içinde):

```mermaid
flowchart LR
    A[cors] --> B[morgan]
    B --> C[express.json]
    C --> D[correlationIdMiddleware]
    D --> E[projectContextMiddleware]
    E --> F[workspaceContextMiddleware]
    F --> G[auditMiddleware]
    G --> H[responseEnvelopeMiddleware]
    H --> I[policyGuardrailMiddleware]
    I --> J[Core Routes]
    J --> K[Plugin Routes]
    K --> L[404 NotFoundError]
    L --> M[Global Error Handler]
```

| Sıra | Middleware | Dosya | Görev |
|------|------------|-------|-------|
| 1 | `cors()` | express | Cross-origin istekler |
| 2 | `morgan("dev")` | express | HTTP access log |
| 3 | `express.json()` | express | JSON body parse |
| 4 | `correlationIdMiddleware` | server.js | `x-correlation-id` üret/echo |
| 5 | `projectContextMiddleware` | server.js | `x-project-id`, `x-env` veya default |
| 6 | `workspaceContextMiddleware` | workspace.js | Workspace bağlamı |
| 7 | `auditMiddleware` | audit.js | HTTP istek audit (ring buffer) |
| 8 | `responseEnvelopeMiddleware` | server.js | `{ ok, data/error, meta }` zarfı |
| 9 | `policyGuardrailMiddleware` | policy-guard.js | Write isteklerinde policy değerlendirme |

**Plugin route'ları** middleware zincirinden sonra mount edilir. Her plugin kendi router'ında `requireScope()` uygular.

**MCP `/mcp` endpoint'i** ayrı middleware kullanır (`mcp/http-transport.js`) — REST `requireScope` zincirine girmez; kendi Bearer token doğrulamasını yapar.

---

## Katman Mimarisi (PLAN-V2)

```mermaid
flowchart TB
    subgraph AI["AI Zeka Katmanı"]
        llm["llm-router"]
        brain["brain"]
        rag["rag"]
        prompt["prompt-registry"]
    end

    subgraph Code["Kod & Git Katmanı"]
        gh["github"]
        git["git"]
        shell["shell"]
        ws["workspace"]
        cr["code-review"]
        repo["repo-intelligence"]
        gpa["github-pattern-analyzer"]
    end

    subgraph Project["Proje & Otomasyon"]
        po["project-orchestrator"]
        n8n["n8n"]
        n8nw["n8n-workflows"]
        notion["notion"]
        tech["tech-detector"]
    end

    subgraph Infra["Altyapı & Güvenlik"]
        db["database"]
        sec["secrets"]
        http["http"]
        obs["observability"]
    end

    po --> notion
    po --> gh
    po --> llm
    cr --> llm
    cr --> ws
    repo --> gh
    gpa --> gh
    brain --> llm
    prompt --> brain
    http --> sec
```

Toplam **20 core plugin** + **15 extension plugin** = **35 plugin**.

---

## Core Endpoint Haritası

Sunucu tarafından doğrudan sağlanan route'lar (`server.js`):

| Method | Path | Scope | Açıklama |
|--------|------|-------|----------|
| GET | `/health` | — | Sağlık kontrolü (auth durumu dahil) |
| GET | `/whoami` | read | Auth scope ve proje bağlamı |
| GET | `/plugins` | read | Yüklü plugin manifest listesi |
| GET | `/plugins/:name/manifest` | read | Tek plugin manifest |
| GET | `/openapi.json` | read | Otomatik OpenAPI 3.0 spec |
| GET | `/audit/logs` | read | HTTP istek audit logları |
| GET | `/audit/stats` | read | HTTP audit istatistikleri |
| GET | `/audit/operations` | read | Core işlem audit kayıtları |
| POST | `/jobs` | write | Asenkron job gönder |
| GET | `/jobs` | read | Job listesi |
| GET | `/jobs/:id` | read | Job detayı |
| GET | `/jobs/stats` | read | Job istatistikleri |
| GET | `/approvals/pending` | read | Bekleyen onaylar |
| POST | `/approve` | write | Onaylanmış tool çalıştır |
| ALL | `/mcp` | MCP auth | MCP Streamable HTTP gateway |
| GET | `/ui`, `/admin` | — | Statik web panelleri |
| POST | `/ui/token` | localhost | 6 haneli UI oturum kodu |
| GET | `/` | — | Landing page |

Plugin endpoint'leri otomatik keşfedilir ve `/openapi.json`'a birleştirilir. Detaylı liste: [api-reference.md](./api-reference.md).

---

## Tool Registry ve MCP Gateway

```mermaid
flowchart LR
    Plugin["Plugin tools[]"] -->|registerTool| Registry["tool-registry.js"]
    MCPHTTP["/mcp HTTP"] --> Gateway["gateway.js"]
    STDIO["mcp-hub-stdio.js"] --> Gateway
    Gateway -->|listTools / callTool| Registry
    Registry --> Hooks["tool-hooks (policy)"]
    Hooks --> Handler["plugin handler"]
```

- **Kayıt:** Plugin yükleme sırasında `plugins.js` her tool'u `registerTool()` ile registry'ye ekler.
- **Çağrı:** `callTool(name, args, context)` before-hook → handler → audit → after-hook.
- **MCP:** `gateway.js` SDK `Server` instance'ı oluşturur; `ListTools` ve `CallTool` handler'ları registry'yi kullanır.

---

## Veri ve Durum Depolama

| Bileşen | Bellek | Redis | Dosya |
|---------|--------|-------|-------|
| Jobs | Varsayılan | `REDIS_URL` ile kalıcı | — |
| HTTP audit | Ring buffer (1000) | — | `AUDIT_LOG_FILE=true` |
| Core audit | Memory sink | — | `AUDIT_SINKS=file` |
| Brain/RAG cache | — | Opsiyonel | `CATALOG_CACHE_DIR` |
| Prompt registry | — | — | `prompts-v2.json` |
| Policy rules | Bellek | — | `presets.json` bootstrap |

Redis başlatılamazsa jobs otomatik bellek moduna düşer.

---

## Multi-Tenant Proje Bağlamı

Her istekte:

- `x-project-id` → `req.projectId`
- `x-env` → `req.projectEnv`

`REQUIRE_PROJECT_HEADERS=true` ise header'lar zorunludur; aksi halde `DEFAULT_PROJECT_ID` / `DEFAULT_ENV` kullanılır.

Job gönderiminde proje bağlamı job context'ine eklenir.

---

## Response Envelope

Tüm JSON yanıtlar standart zarf formatına normalize edilir:

**Başarı:**
```json
{
  "ok": true,
  "data": { },
  "meta": { "requestId": "req-..." }
}
```

**Hata:**
```json
{
  "ok": false,
  "error": { "code": "...", "message": "...", "details": {} },
  "meta": { "requestId": "req-..." }
}
```

---

## İlgili Belgeler

- [Core Bileşenler](./core-components.md)
- [Güvenlik](./security.md)
- [MCP Entegrasyonu](./mcp-integration.md)
- [Plugin Genel Bakış](./plugins/overview.md)
