# 00 — V6 Vizyon: Agent Ekosistemi Ölçeklenir

> **Status:** mvp_done  
> **Kapatıldı:** 2026-06-26

---

## Tek cümle

**mcp-hub V6**, "agent daha fazla ne yapabilir?" sorusundan **"agent ekosistemi nasıl ölçeklenir, güvenilirleşir ve kişiselleşir?"** sorusuna geçer.

---

## Evrim çizgisi

| Aşama | Seviye | Soru |
|-------|--------|------|
| V4 | Agent iş yapabiliyor | Workflow tasarla, onayla, masaüstünde çalıştır |
| V5 | Operasyonel yönetim | Runbook, schedule, SLA, env promotion |
| **V6** | Ekosistem ölçekleniyor | Ekip gibi çalış, event tetikle, kurumsal ürün |

V4 premium kabiliyet verir. V5 bunları **günlük operasyona** bağlar. V6 **çoklu agent**, **skill katmanı**, **olay tetikleyicileri** ve **kurumsal yönetim** ile ölçeklenir.

---

## Stratejik beşli (öncelik)

```text
Multi-Agent Collaboration
Agent Skill Store
Autonomous Watchers
Sandbox / Simulation Lab
Agent Trust Score
```

Kurumsal ve kişiselleştirme katmanı:

```text
Agent App Store
Enterprise Compliance Pack
Natural Language Admin
Knowledge Conflict Resolver
Personal Operating Model
```

---

## Ürün ilkeleri (V6)

1. **Agents as teams** — Tek run yerine parent/child run ile rol bazlı iş bölümü.
2. **Skills over raw workflows** — Skill = prompt + tools + eval + policy + examples.
3. **Event-driven, not only on-demand** — Watchers olay görünce run açar.
4. **Trust is measurable** — Her agent/workflow için skor; kurumsal güven.
5. **Explicit personal memory** — remember / forget / pin / edit; gizli öğrenme yok.

---

## Kapsam dışı (bilinçli)

- Genel amaçlı AGI platformu
- Tam otonom production deploy (insan/approval bypass)
- Consumer chatbot marketplace

---

## Sonraki adım

[EXECUTION-ORDER.md](./EXECUTION-ORDER.md) → Faz V6.1: [01-multi-agent-collaboration.md](./01-multi-agent-collaboration.md)
