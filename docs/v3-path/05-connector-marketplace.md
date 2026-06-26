# 05 — Connector Marketplace (Kontrollü)

> **Status:** mvp_done (v3.6) — dangerousCombinations UI done  
> **Last reviewed:** 2026-06-25  
> **Öncelik:** P2 (Faz 3)  
> **Bağımlılık:** [08-secrets-env-management.md](./08-secrets-env-management.md), [10-production-hardening.md](./10-production-hardening.md)

---

## Amaç

35 plugin'i **iç marketplace** deneyimine çevirmek — install/enable/disable, env wizard, health check, permission manifest, test connection, version/maturity badge. **Admin-only, fail-closed.**

---

## Mevcut durum

| Var | Eksik (v3.7+) |
|-----|---------------|
| `plugin_state` persistence + enable/disable | npm marketplace → `marketplace/installed/` loader |
| `internal-routes.js` — catalog, wizard, test | Policy default deny shell (Faz C üretim) |
| `PluginsPage` — toggle + SetupWizardDialog | |
| `dangerousCombinations` enable uyarısı (v3.6) | |
| `marketplace-enable.test.js` | |
| Eksik env → enable blok | |
| **Dış MCP (stdio)** — `mcp-connectors/` + Plugins **Dış MCP** sekmesi | HTTP/SSE doğrudan URL, OAuth, harici npm install |

---

## Marketplace ilkeleri

1. **Admin-only** — `requireScope("admin")` tüm mutasyonlar
2. **Fail-closed** — Default disabled olan capability'ler açıkça enable edilmeli
3. **Manifest zorunlu** — `security.capabilities`, `envVars`, `riskLevel`
4. **No arbitrary install** — V3: repo içi `src/plugins/*`; harici MCP stdio bağlantıları → [mcp-connectors.md](../mcp-connectors.md); npm paket kurulumu sonraki faz
5. **Unsafe warning** — `shell`, `destructive` açık uyarı

---

## Plugin yaşam döngüsü

```mermaid
stateDiagram-v2
  [*] --> Discovered: scan plugins/
  Discovered --> Disabled: default
  Disabled --> Enabled: admin + env ok
  Enabled --> Healthy: health check pass
  Enabled --> Degraded: health fail
  Degraded --> Disabled: admin
  Healthy --> Disabled: admin
```

### `plugin_state` (MSSQL veya config overlay)

| Alan | Açıklama |
|------|----------|
| `plugin_name` | |
| `enabled` | bool |
| `enabled_at` | |
| `enabled_by` | |
| `last_health` | ok / fail |
| `env_complete` | bool |

Startup: `STRICT_PLUGIN_LOADING` + enabled listesi.

---

## UI: Plugin Setup Wizard

Adımlar (her plugin için):

1. **Overview** — description, maturity badge, tool count
2. **Permissions** — capability manifest, risk özeti
3. **Configuration** — required/optional env, masked inputs
4. **Test connection** — `POST /plugins/:name/health` veya özel test
5. **Enable** — onay checkbox ("I understand shell access")

Mevcut `SettingsPage` entegrasyonları ile birleştir.

---

## API

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/marketplace/catalog` | Tüm plugin meta + state |
| POST | `/marketplace/plugins/:name/enable` | admin |
| POST | `/marketplace/plugins/:name/disable` | admin |
| POST | `/marketplace/plugins/:name/test` | connection test |
| GET | `/marketplace/plugins/:name/wizard` | required env + health schema |

---

## Maturity badge

`plugin.meta.json` → `status`: `experimental` | `beta` | `stable`

UI renkleri + "production use" uyarısı experimental için.

---

## Uygulama fazları

### Faz A — Enable/disable (1 hafta)

- [x] `plugin_state` persistence
- [x] `plugins.js` — disabled plugin tool register etmez
- [x] PluginsPage toggle (admin)

### Faz B — Wizard (1 hafta)

- [x] Env catalog → wizard adımları
- [x] Test connection endpoint standardı (`mountPluginHealth` + `/marketplace/plugins/:name/test`)
- [x] Incomplete env → enable blokla

### Faz C — Unsafe capabilities (1 hafta)

- [x] Manifest `security.dangerousCombinations` UI uyarısı
- [ ] Policy default deny shell in production

---

## Exit criteria

- [x] Admin plugin'i disable edince tool listesinden kaybolur
- [x] Yeni plugin kurulumu wizard ile < 15 dk (dokümante senaryo)
- [x] `validate:plugins` + marketplace state CI testi

**Sonraki:** [07-eval-regression.md](./07-eval-regression.md)
