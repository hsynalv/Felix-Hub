# 02 — Policy + Approval Center

> **Status:** not_started  
> **Öncelik:** P0 (Faz 1)  
> **Bağımlılık:** [01-agent-runtime-workflow.md](./01-agent-runtime-workflow.md) (checkpoint modeli)

---

## Amaç

Mevcut policy altyapısını **ürünleşmiş güvenlik katmanına** dönüştürmek — risk seviyesine göre onay, proje/ortam kuralları, merkezi approval UI, dry-run ve geçmiş kararlardan öğrenme.

**Farklılaşma:** "Güvenli agent execution"ın kalbi.

---

## Mevcut durum

| Var | Eksik |
|-----|-------|
| `policy-guard.js`, `policy` plugin | Proje bazlı kural UI yok |
| Tool tags: `write`, `destructive`, `needs_approval` | Ortam bazlı (prod vs dev) ayrımı zayıf |
| Chat'te approval dialog | Merkezi queue + geçmiş |
| `?confirmed=true` bypass (TD-8) | Dry-run modu ürün değil |
| Admin onay listesi (basit) | Risk matrisi, policy editor |

**İlgili dosyalar:** `mcp-server/src/core/policy-guard.js`, `mcp-server/src/plugins/policy/`, `mcp-server/frontend/src/pages/AdminPage.tsx`

---

## Risk modeli

| Seviye | Tag örnekleri | Varsayılan |
|--------|---------------|------------|
| **Read** | `read_only` | Otomatik izin |
| **Write** | `write` | Scope + policy |
| **Destructive** | `destructive` | Onay zorunlu |
| **External** | `EXTERNAL_API`, `NETWORK` | Proje kuralına bağlı |
| **Local** | `LOCAL_FS`, `shell` | En kısıtlı; sidecar ayrı model (Pillar 09) |

---

## Policy kural şeması (öneri)

```json
{
  "id": "prod-no-shell",
  "scope": { "environment": "production", "projectId": "*" },
  "effect": "deny",
  "tools": ["shell_*", "docker_*"],
  "reason": "Production'da shell yasak"
}
```

```json
{
  "id": "notion-write-ok",
  "scope": { "projectId": "proj-abc" },
  "effect": "allow",
  "tools": ["notion_*"],
  "requiresApproval": false
}
```

Depolama: MSSQL `policy_rules` veya JSON dosya + UI edit (admin).

---

## Approval Center (UI)

### Sayfa: `/approvals` (yeni veya Admin genişletme)

| Bölüm | İçerik |
|-------|--------|
| **Bekleyen** | run_id, tool, args özeti, risk badge, süre |
| **Geçmiş** | approve/deny, kim, ne zaman |
| **Kurallar** | Policy listesi (read-only başlangıç) |
| **Öneriler** | "Son 10 deny → şu kuralı ekle?" (Faz C) |

### Aksiyonlar

- Onayla / Reddet / Onayla + bu tool için proje kuralı öner
- Toplu onay (dikkatli; admin only)

---

## Dry-run modu

| Mod | Davranış |
|-----|----------|
| `dry_run=true` (run veya tool) | Tool handler'a `context.dryRun`; yazma yapmaz, simulated output |
| Policy preview | "Bu argümanlarla çalıştırsaydın ne olurdu?" |

**Kaldırılacak / sıkılaştırılacak:** `?confirmed=true` query bypass (TD-8) → admin audit + explicit dry-run API.

---

## Uygulama fazları

### Faz A — Run-aware approval (1 hafta)

- [ ] Approval kaydı: `run_id`, `step_id`, `tool`, `arguments_hash`
- [ ] `POST /approvals/pending` run metadata ile zenginleştir
- [ ] Chat approval → aynı store
- [ ] Red/detay audit

**Exit:** Tek approval kuyruğu hem chat hem run.

### Faz B — Policy UI + environment scope (2 hafta)

- [ ] `GET/POST /policy/rules` (admin)
- [ ] `environment` tag: `NODE_ENV` veya `HUB_ENV=production|staging|dev`
- [ ] Policy evaluate: projectId + env + tool name glob
- [ ] Frontend: kural listesi + basit form

**Exit:** "Production'da shell yasak" kuralı UI'dan eklenip uygulanır.

### Faz C — Öneri motoru + dry-run (2 hafta)

- [ ] Approval geçmişinden pattern: sık reddedilen tool → kural önerisi
- [ ] `POST /tools/:name/dry-run` endpoint
- [ ] Plugin handler'larda `context.dryRun` convention dokümantasyonu

**Exit:** Dry-run ile destructive tool test edilebilir, yan etki yok.

---

## API özeti

| Method | Path | Scope |
|--------|------|-------|
| GET | `/policy/rules` | admin |
| POST | `/policy/rules` | admin |
| POST | `/policy/evaluate` | read (preview) |
| GET | `/approvals/pending` | admin |
| POST | `/approve` | admin (mevcut) |
| GET | `/approvals/history` | admin |

---

## Plugin manifest genişlemesi (Pillar 05 ile uyumlu)

`plugin.meta.json`:

```json
{
  "security": {
    "capabilities": ["network", "filesystem"],
    "defaultRisk": "write",
    "requiresApproval": ["shell_exec"]
  }
}
```

Policy engine manifest'i tool tag'lerle birleştirir.

---

## Exit criteria

- [ ] Risk seviyesi her pending approval'da görünür
- [ ] Proje + env bazlı en az 1 deny kuralı çalışır
- [ ] Dry-run en az 2 plugin'de (shell, notion) desteklenir
- [ ] `?confirmed=true` bypass kapatıldı veya admin-only audit'li

**Sonraki:** [04-visual-run-dashboard.md](./04-visual-run-dashboard.md)
