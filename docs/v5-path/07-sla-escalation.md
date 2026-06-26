# 07 — Operational SLAs & Escalation

> **Status:** done  
> **Faz:** V5.8  
> **Bağımlılık:** [10-managed-autonomy-policies.md](./10-managed-autonomy-policies.md), [02-scheduled-agent-operations.md](./02-scheduled-agent-operations.md)

---

## Amaç

Agent işi yapamazsa ne olacak? Operasyon kural katmanı — V6 Agent Inbox'tan önce gerekli omurga.

---

## Kapsam

- Run timeout
- Approval timeout
- Cost threshold
- Repeated failure
- Human escalation
- Owner assignment
- "Page me" notification
- Auto-create GitHub issue / Notion task

---

## Escalation kuralları (örnek)

```text
approval_timeout > 4h → notify owner → create GitHub issue
run_fail_count >= 3 → escalate to human, pause schedule
cost > budget → stop run, inbox alert
```

---

## Teknik model

```text
sla_policy: scope (project, runbook, schedule)
  rules: timeout | approval_wait | cost | failure_count
  action: notify | pause | escalate | create_ticket
  target: user | team | github_issue | notion_task
```

---

## Kapsam (implementation)

- [x] `sla_policies` + evaluator (run/schedule lifecycle hooks)
- [x] Escalation action executor
- [x] Owner assignment (project metadata)
- [x] Paging integration (notifications: Telegram, Slack)
- [x] GitHub issue / Notion task auto-create
- [x] SLA dashboard: ihlaller, ortalama çözüm süresi (`GET /sla/dashboard` + Ops UI)

---

## Başarı kriteri

- [x] Approval 4 saat bekleyince owner'a bildirim + opsiyonel issue açılır
- [x] 3 ardışık run failure schedule'ı pause eder

---

## Sonraki

[04-incident-triage-agent.md](./04-incident-triage-agent.md)
