# 04 — Incident Triage Agent

> **Status:** done  
> **Faz:** V5.9  
> **Bağımlılık:** [07-sla-escalation.md](./07-sla-escalation.md), [V4 Project Command Center](../v4-path/05-project-command-center.md)

---

## Amaç

Observability + project context + agent runs birleşimi — olay anında triage ve önerilen aksiyon.

---

## Akış

```text
error spike → ilgili commitleri bul → son deploy'u bul → logları oku
→ riskli PR'ları listele → önerilen aksiyon → onayla rollback/fix
```

---

## Özellikler

- Incident timeline
- Suspected cause ranking
- Owner önerisi
- Related runs/PR/issues
- Postmortem draft

---

## Kapsam

- [x] Incident runbook preset
- [x] Observability plugin entegrasyonu (Sentry/Datadog/generic webhook + audit fallback)
- [x] GitHub: son deploy, ilgili PR/commit korelasyonu
- [x] Suspected cause ranking (heuristic + LLM özet)
- [x] Triage UI: timeline, aksiyon butonları
- [x] Postmortem draft → Notion/Obsidian export
- [x] SLA escalation entegrasyonu

---

## Başarı kriteri

- [x] Simüle error spike için timeline + suspected cause listesi üretilir
- [x] Onaylı rollback/fix runbook'u tetiklenebilir

---

## Sonraki

[08-environment-promotion-change-control.md](./08-environment-promotion-change-control.md)
