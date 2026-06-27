# Shell Plugin

Production-hardened shell command execution with **safe** and **power** modes.

## Security Model

**Default in production: `SHELL_MODE=safe` (read-only allowlist)**

| Mode | Allowlist | Operators (`|`, `&&`, …) | Sessions / background |
|------|-----------|---------------------------|------------------------|
| `safe` | `ls,cat,echo,grep,find,head,tail,wc,stat,du,df,ps,uname,whoami,pwd,git` | Blocked | Disabled |
| `power` | Extended list + `SHELL_ALLOWLIST` override | Allowed when binaries are allowlisted | Enabled |

- Dangerous patterns (`rm -rf`, `sudo`, disk writes, remote pipe-to-bash) are always blocked
- Policy plugin: destructive tools require approval when `destructive_requires_approval` is on (default)
- Structured audit logging with secret redaction (`redactShellCommand`)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SHELL_MODE` | `safe` in production, `power` in dev | `safe` or `power` |
| `SHELL_ALLOWLIST` | Mode preset | Comma-separated command prefixes (overrides preset) |
| `SHELL_DEFAULT_TIMEOUT_MS` | `30000` | Default execution timeout (ms) |
| `SHELL_MAX_TIMEOUT_MS` | `300000` | Maximum allowed timeout (ms) |
| `ALLOWED_WORKING_DIRS` | `''` | If empty, only current working directory is allowed |
| `SHELL_AUDIT_TYPE` | `memory` | Audit sink: `memory`, `file`, `redis`, or `multi` |
| `SHELL_AUDIT_FILE_PATH` | `./logs/shell-audit.jsonl` | File path when using `file` sink |
| `SHELL_AUDIT_MAX_ENTRIES` | `1000` | Max audit entries per sink |

## Endpoints

| Endpoint | Method | Scope | Description |
|----------|--------|-------|-------------|
| `/shell/execute` | POST | `write` | Execute a shell command |
| `/shell/execute/stream` | POST | `write` | Execute with streaming output (SSE) — power mode only |
| `/shell/audit` | GET | `read` | Get execution audit log |
| `/shell/safety` | GET | `read` | Get safety configuration |

## MCP Tools

| Tool | Tags | Description |
|------|------|-------------|
| `shell_execute` | `write`, `destructive`, `local_fs` | Execute allowed command |
| `shell_audit` | `read` | Get audit log entries |
| `shell_safety_check` | `read` | Check if command would be allowed |

## Safe mode allowlist

`ls`, `cat`, `echo`, `grep`, `find`, `head`, `tail`, `wc`, `stat`, `du`, `df`, `ps`, `uname`, `whoami`, `pwd`, `git`

**Blocked in safe mode:** `curl`, `wget`, `python`, `node`, `npm`, `pip`, `env`, `printenv`, pipes, redirects, subshells, background jobs, sessions.

**Git in safe mode:** only read-only subcommands — `status`, `diff`, `log`, `show`, `branch` (list), `rev-parse`, `describe`, `shortlog`, `stash list/show`.

## Power mode (admin-only)

`SHELL_MODE=power` enables the extended allowlist, `shell: true` spawn, sessions, streaming, and background jobs.

**Requires `HUB_ADMIN_KEY` scope** for all shell write endpoints and MCP tools. Every command still flows through policy approval (`destructive_requires_approval`).

Use only when you explicitly need full shell automation in a controlled production environment.

## Blocked dangerous patterns (all modes)

| Pattern | Example |
|---------|---------|
| Shell chaining | `&&`, `\|\|`, `;` (safe mode always; power mode via operator rules) |
| Pipes / redirects | `\|`, `>`, `<` (safe mode) |
| Subshells | `$(...)`, `` `...` `` |
| Privilege / disk | `sudo`, `rm -rf`, `dd`, `mkfs` |

## Examples

### Execute Command
```bash
POST /shell/execute
{
  "command": "ls -la",
  "cwd": "./workspace",
  "timeout": 30000
}
```

Success Response:
```json
{
  "ok": true,
  "data": {
    "command": "ls -la",
    "exitCode": 0,
    "stdout": "...",
    "stderr": "",
    "correlationId": "..."
  }
}
```
