# 08 — Secrets ve Env Yönetimini Ürünleştir

> **Status:** in_progress (kısmen)  
> **Öncelik:** P1 (Faz 2–3)  
> **Bağımlılık:** [05-connector-marketplace.md](./05-connector-marketplace.md)

---

## Amaç

Settings UI'ı tam **integration setup center** yapmak: her plugin için required/optional env, connection test, secret rotation, masked audit, stale secret detection, per-project/env secret override. `.env` → MSSQL settings geçişi doğru yön — bunu tamamlamak.

---

## Mevcut durum

| Var | Eksik |
|-----|-------|
| `settings/` modülü — bundle, crypto, routes | Per-project override |
| `SettingsPage` — plugin env formları | Wizard akışı |
| `plugin-env-catalog.js` | Stale detection |
| `plugin.meta.json` envVars | Çoğu boş — doldurulacak |
| `crypto.js` — encrypt at rest | Rotation workflow UI |
| MSSQL persistence | Secret audit log |

**İlgili:** `mcp-server/src/core/settings/`, `mcp-server/frontend/src/pages/SettingsPage.tsx`

---

## Hedef deneyim

```
Integration Setup Center
├── Global secrets (server-wide)
├── Per-plugin panels
│   ├── Required ✓ / Optional
│   ├── Masked value + "reveal" (admin, audit)
│   ├── Test connection
│   └── Last verified / stale warning
├── Per-project overrides (V3.1)
│   └── NOTION_* farklı proje DB
└── Rotation
    ├── Generate new → dual-write period → revoke old
    └── Audit trail
```

---

## Veri modeli

### `settings_entries` (mevcut)

Genişletme:

| Alan | Açıklama |
|------|----------|
| `scope` | `global`, `project:{id}` |
| `last_verified_at` | Test connection zamanı |
| `stale_after_days` | Config |
| `rotated_from` | rotation chain |

### `settings_audit`

| Alan | Açıklama |
|------|----------|
| `action` | set, reveal, rotate, test |
| `key` | masked key name |
| `actor` | user/api_key |
| `timestamp` | |

Asla plaintext value loglama.

---

## Connection test standardı

Her plugin `plugin.meta.json`:

```json
{
  "health": {
    "testEndpoint": "/plugins/notion/health",
    "requiredEnv": ["NOTION_API_KEY"]
  }
}
```

`POST /settings/test/:plugin` → plugin health çağırır → `last_verified_at` günceller.

---

## Stale secret detection

Cron veya startup:

- `last_verified_at` > `stale_after_days` → UI amber badge
- Health fail 3x → notification + disable plugin önerisi (admin)

---

## Rotation workflow

1. Admin yeni secret girer (pending)
2. Test connection başarılı
3. Atomic swap — eski değer `rotated_from` chain'de
4. Audit: rotate event
5. Opsiyonel: eski secret grace period (24h dual valid)

---

## Per-project override

Örnek: Proje A farklı Notion DB, Proje B farklı GitHub org.

```
effective_config(project_id) =
  merge(global_settings, project_overrides, env_bootstrap)
```

`effective-config.js` genişlet — öncelik sırası dokümante.

---

## Uygulama fazları

### Faz A — Meta + catalog tamamlama (1 hafta)

- [ ] 35 plugin `envVars` doldur (`sync-plugin-meta-env.js`)
- [ ] Settings UI required/optional ayrımı
- [ ] Incomplete env → plugin enable uyarısı

### Faz B — Test + verify (1 hafta)

- [ ] Standard health test endpoint
- [ ] `last_verified_at` persistence
- [ ] Settings'te "Test connection" butonu

### Faz C — Audit + masked reveal (1 hafta)

- [ ] `settings_audit` tablosu
- [ ] Admin reveal (tek seferlik, loglanır)

### Faz D — Rotation + stale (1 hafta)

- [ ] Rotation service UI
- [ ] Stale badge + cron check

### Faz E — Project override (1 hafta)

- [ ] `scope: project:{id}` settings
- [ ] Orchestrator `getEffectiveConfig(projectId)`

---

## Exit criteria

- [ ] Yeni kurulumda `.env` sadece bootstrap (MSSQL + crypto key)
- [ ] Tüm kritik plugin'ler connection test ile doğrulanabilir
- [ ] Secret değişikliği audit'te görünür (value yok)
- [ ] Marketplace wizard (Pillar 05) env adımlarını bu modülden beslenir

**Sonraki:** [05-connector-marketplace.md](./05-connector-marketplace.md)
