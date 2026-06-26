# 01 — Multi-Agent Collaboration

> **Status:** mvp_done  
> **Faz:** V6.1  
> **Bağımlılık:** [V4 Agent Runtime v2](../v4-path/02-agent-runtime-v2.md)

---

## Amaç

Tek agent yerine rol bazlı agent ekipleri ile karmaşık işleri güvenle bölmek.

---

## Roller (örnek)

- Planner agent
- Coder agent
- Reviewer agent
- QA agent
- Research agent
- Security agent
- Release manager agent

---

## Örnek akış

```text
Planner spec çıkarır → Coder uygular → Reviewer eleştirir → QA test yazar → Release agent PR hazırlar
```

---

## Teknik model

Mevcut `agent_runs` üstüne **parent run / child run** modeli:

```text
parent_run_id
child_run_id
role: planner | coder | reviewer | ...
handoff_payload
```

- Her child run kendi timeline, maliyet ve approval akışına sahip.
- Parent run orchestrator: sıra, branch, handoff koşulları.

---

## Kapsam

- [ ] `agent_runs.parent_run_id` + role metadata
- [ ] Multi-agent workflow template tipi
- [ ] Child run spawn + handoff API
- [ ] Parent timeline: child özetleri aggregate
- [ ] Per-role policy (ör. Security agent destructive tool alamaz)
- [ ] Run Designer: multi-agent step tipi

---

## Başarı kriteri

- [ ] Planner → Coder → Reviewer zinciri tek parent run altında izlenebilir
- [ ] Child run başarısızlığı parent'ta branch/retry ile yönetilir

---

## Sonraki

[02-agent-skill-store.md](./02-agent-skill-store.md)
