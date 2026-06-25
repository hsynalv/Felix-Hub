# 06 — Agent Reports & Briefings

> **Status:** not_started  
> **Faz:** V5.7  
> **Bağımlılık:** [V4 Run Dashboard](../v3-path/04-visual-run-dashboard.md), [01-runbook-automation.md](./01-runbook-automation.md)

---

## Amaç

V4 run dashboard verisini **yöneticinin okuyacağı rapor**a çevirmek.

---

## Rapor türleri

- Daily engineering brief
- Weekly project health
- Release readiness
- Cost report
- Risk report
- Incident summary
- Agent productivity report

---

## Çıktı kanalları

- UI
- Email
- Slack/Telegram
- Notion
- Obsidian

---

## Kapsam

- [ ] Report template engine (sections, data sources)
- [ ] Report schedule (02 ile entegre)
- [ ] Data aggregation: runs, cost, approvals, incidents
- [ ] Briefing UI: okundu, arşiv, paylaş
- [ ] Channel delivery (notifications plugin)
- [ ] Markdown/PDF export

---

## Başarı kriteri

- [ ] Daily engineering brief sabah schedule ile üretilir ve Inbox/UI'da görünür
- [ ] En az bir dış kanala (Slack veya Notion) gönderim çalışır

---

## Sonraki

[07-sla-escalation.md](./07-sla-escalation.md)
