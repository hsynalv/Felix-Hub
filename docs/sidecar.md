# Local Sidecar

The sidecar is a **local daemon** on your machine. MCP Hub delegates filesystem, terminal, and desktop notification actions to it when `LOCAL_FS_ON_SERVER=false` (default in production).

## Quick start

```bash
# 1. Start sidecar (terminal 1)
cd mcp-server
npm run sidecar:daemon

# 2. Get pairing code (admin API)
curl -X POST http://localhost:8787/sidecar/pairing/code \
  -H "Authorization: Bearer $HUB_ADMIN_KEY"

# 3. Pair device
curl -X POST http://localhost:8787/sidecar/pair \
  -H "Authorization: Bearer $HUB_WRITE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"code":"123456","deviceName":"my-mac","baseUrl":"http://127.0.0.1:9477"}'

# Response includes authToken — set on daemon:
SIDECAR_AUTH_TOKEN=<authToken> npm run sidecar:daemon
```

## Capabilities

| API | Sidecar route | MCP tool |
|-----|---------------|----------|
| List/read/write files | `/fs/*` | `fs_list`, `fs_read`, `fs_write` |
| Terminal exec | `/terminal/exec` | `local_terminal_exec` |
| Terminal session | `/terminal/sessions` | `local_terminal_session_*` |
| Desktop notify | `/notify` | `local_notify` |

## Security

- Binds to `127.0.0.1` only
- Filesystem whitelist (`whitelist.json` or defaults)
- Terminal command allowlist + blocklist
- Optional `SIDECAR_AUTH_TOKEN` (returned once at pairing)
- Hub stores token per device; proxies with `Authorization: Bearer`

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `LOCAL_FS_ON_SERVER` | `true` in dev, implied `false` in prod | Delegate local actions to sidecar |
| `SIDECAR_PORT` | `9477` | Sidecar listen port |
| `SIDECAR_AUTH_TOKEN` | — | Shared secret (from pairing) |
| `SIDECAR_TERMINAL_ALLOWLIST` | `ls,cat,echo,...` | Allowed terminal binaries |

## Packaging

```bash
# From repo
npm run sidecar:daemon

# Or via bin (from mcp-server package)
npx --prefix mcp-server node bin/sidecar-daemon.js
```

Full mTLS and auto-update are planned for a later release.
