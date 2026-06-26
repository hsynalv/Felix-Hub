# 06 — Life Automation Agents

> **Status:** `mvp_done` — preset + CRUD + dry-run + watcher bind  
> **Production:** `pending` — scheduler + source + executor → [POST-MVP-BACKLOG](./POST-MVP-BACKLOG.md#2-life-agent-execution-pipeline-79-prod)
> **Faz:** V7.9  
> **Bağımlılık:** [02-daily-briefing-agent.md](./02-daily-briefing-agent.md), [07-personal-memory-profile.md](./07-personal-memory-profile.md)

---

## Amaç

Kod dışı **günlük hayat agent'larını** standartlaştırmak.

---

## Agent tipleri

```text
Mail Triage Agent
News Briefing Agent
Calendar Prep Agent
Shopping Research Agent
Reminder Agent
Research Agent
Reading List Agent
Finance Summary Agent
Travel Planning Agent
Obsidian Organizer Agent
```

---

## Ortak model

Her life agent:

```text
name
goal
sources
allowed_tools
schedule
approval_policy
output_channels
memory_scope
cost_limit
```

---

## Örnekler

```text
Toplantıdan 30 dk önce ilgili mailleri ve notları özetle.
Haftalık harcamaları kategorilere ayır.
Okumam gereken AI makalelerini bul ve Obsidian'a kaydet.
```

---

## Altyapı notu

**n8n** ayrı pillar değil — karmaşık life automation akışları için mevcut n8n plugin orchestration katmanı olarak kullanılır. Life agent profili → n8n workflow veya native runbook'a derlenebilir.

---

## Kapsam

### MVP (done)

- [mvp] Life agent profile schema + CRUD API
- [mvp] Preset katalog (8 tip)
- [mvp] Dry-run test (`POST …/test`)
- [mvp] Watcher bind (placeholder skill; `dryRun: true`)
- [mvp] UI: `/life` sayfası

### Production (pending)

- [prod] **Executor:** preset → gerçek workflow (skill/template/n8n)
- [prod] **Scheduler:** `intervalMinutes` → V5 schedule fire
- [prod] **Source connectors:** mail → IMAP; news → RSS
- [prod] **Output delivery:** Telegram push, inbox item
- [prod] Run history + cost cap enforcement
- [prod] Bundle: "her sabah mail + haber + Telegram özet"

---

## Başarı kriteri

- [mvp] Kullanıcı agent profili tanımlayabilir ve test edebilir
- [prod] Zamanlanmış agent gerçek kaynaklardan veri çekip Telegram'a özet gönderir

---

## Sonraki

[09-jarvis-interface.md](./09-jarvis-interface.md)
