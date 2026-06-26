# External MCP Connectors

Hub can federate **external MCP servers** (Tavily, Figma, etc.) over **stdio** into the same tool registry used by Chat, Runs, and `POST /mcp`.

## Overview

| Layer | Responsibility |
|-------|----------------|
| `connector.service.js` | CRUD, validation, env merge from encrypted settings |
| `mcp-client.js` | SDK `Client` + `StdioClientTransport` |
| `tool-bridge.js` | Register upstream tools as `{slug}__{toolName}` |
| `routes.js` | Admin REST API |
| Plugins UI → **Dış MCP** tab | Create, test, enable/disable connectors |

## Tool naming

Upstream tool `tavily_search` on connector `tavily` becomes:

```
tavily__tavily_search
```

The `plugin` field on registered tools equals the connector **slug**, so `unregisterToolsForPlugin(slug)` removes all federated tools.

## REST API (admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/mcp-connectors` | List connectors |
| GET | `/mcp-connectors/templates` | Built-in templates (Tavily, Figma) |
| POST | `/mcp-connectors` | Create connector |
| PUT | `/mcp-connectors/:id` | Update connector |
| DELETE | `/mcp-connectors/:id` | Delete (must be disabled) |
| POST | `/mcp-connectors/:id/test` | Spawn + `tools/list` |
| POST | `/mcp-connectors/:id/enable` | Federate tools |
| POST | `/mcp-connectors/:id/disable` | Unregister + kill process |

All mutations require `admin` scope.

## Configuration

Each connector stores:

- `command` — allowlisted: `node`, `npx`, `uvx`, `python`, `python3`
- `args` — JSON array of strings (max ~4k chars total)
- `envKeys` — required env var names (values live in **Settings** encrypted store)

On enable, env values are read via `getEnvValue()` from the settings overlay and passed to the child process.

### Example: Tavily (remote via mcp-remote)

```json
{
  "slug": "tavily",
  "displayName": "Tavily Search",
  "command": "npx",
  "args": ["-y", "mcp-remote", "https://mcp.tavily.com/mcp/?tavilyApiKey={TAVILY_API_KEY}"],
  "envKeys": ["TAVILY_API_KEY"]
}
```

Set `TAVILY_API_KEY` in **Settings → Entegrasyonlar** (or via the connector dialog).

## Lifecycle

1. **Create** connector in UI (optionally from template)
2. **Test** — spawns process, lists tools, updates health
3. **Enable** — keeps process alive, registers proxy handlers
4. **Disable** — unregisters tools, kills process
5. **Startup** — `enabled=true` connectors are hydrated after native plugins load

If hydration fails, the connector is auto-disabled and health is set to `fail`.

## Security

- Admin-only CRUD
- Command allowlist (no shell)
- Env secrets in encrypted settings + audit log
- Federated tools tagged `NETWORK`, `EXTERNAL_API`; write-like names get `write`
- Degraded connector → tool calls return `connector_unavailable`

## Out of scope (next phase)

- HTTP/SSE transport to hosted MCP URLs (without `mcp-remote`)
- OAuth flows (Figma desktop auth)
- Per-connector policy overrides in UI
- npm marketplace → `marketplace/installed/` loader

## Tests

```bash
cd mcp-server
npm test -- tests/core/mcp-connectors
```

Uses `tests/fixtures/mock-mcp-server.js` as a minimal stdio MCP peer.
