# 02 — Scheduled Agent Operations

> **Status:** not_started  
> **Faz:** V5.2  
> **Bağımlılık:** [01-runbook-automation.md](./01-runbook-automation.md), [10-managed-autonomy-policies.md](./10-managed-autonomy-policies.md)

---

## Amaç

Event watcher'dan (V6) önce gelen, yüksek değerli **zamanlama katmanı** — cron-like scheduled agent işleri.

---

## Örnekler

- Her sabah proje özeti çıkar
- Haftalık dependency scan
- Her cuma release notes taslağı
- Her gece failing tests retry/analyze
- Haftalık Obsidian/Notion sync

---

## Özellikler

- Cron-like schedule
- Project scope
- Max cost
- Allowed tools
- Notification target
- Skip conditions

---

## Teknik model

```text
schedule → runbook_id | workflow_template_id
  cron_expr, timezone, project_id
  max_cost_usd, allowed_tools[], autonomy_level
  notify: inbox | slack | email
  skip_if: condition_expr
```

---

## Kapsam

- [ ] `agent_schedules` tablosu + scheduler job
- [ ] Schedule CRUD API + pause/resume
- [ ] Cost/quota pre-check before spawn
- [ ] Schedule UI: oluştur, test fire, geçmiş
- [ ] Skip condition evaluator
- [ ] V6 watchers'a migration path (schedule → watcher upgrade)

---

## Başarı kriteri

- [ ] Haftalık dependency scan zamanında run açar, maliyet limiti aşılırsa atlar
- [ ] Skip condition (ör. "açık incident varsa") çalışır

---

## Sonraki

[10-managed-autonomy-policies.md](./10-managed-autonomy-policies.md)
