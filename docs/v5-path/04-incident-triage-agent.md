# 04 — Incident Triage Agent

> **Status:** not_started  
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

- [ ] Incident runbook preset
- [ ] Observability plugin entegrasyonu (error spike signal)
- [ ] GitHub: son deploy, ilgili PR/commit korelasyonu
- [ ] Suspected cause ranking (heuristic + LLM özet)
- [ ] Triage UI: timeline, aksiyon butonları
- [ ] Postmortem draft → Notion/Obsidian export
- [ ] SLA escalation entegrasyonu

---

## Başarı kriteri

- [ ] Simüle error spike için timeline + suspected cause listesi üretilir
- [ ] Onaylı rollback/fix runbook'u tetiklenebilir

---

## Sonraki

[08-environment-promotion-change-control.md](./08-environment-promotion-change-control.md)
