# 06 — Agent Reports & Briefings

> **Status:** done  
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

- [x] Report template engine (sections, data sources)
- [x] Report schedule (02 ile entegre)
- [x] Data aggregation: runs, cost, approvals, incidents
- [x] Briefing UI: okundu, arşiv, paylaş
- [x] Channel delivery (notifications plugin)
- [x] Markdown/PDF export (`export.md`, `export.html`, `export.pdf`)

---

## Başarı kriteri

- [x] Daily engineering brief sabah schedule ile üretilir ve Inbox/UI'da görünür
- [x] En az bir dış kanala (Slack veya Notion) gönderim çalışır

---

## Sonraki

[07-sla-escalation.md](./07-sla-escalation.md)
