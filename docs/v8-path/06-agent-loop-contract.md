# 06 — Agent Loop Contract

> **Status:** done (MVP)  
> **Bağımlılık:** 03 Tool Intelligence, V4 run orchestrator

---

## Amaç

Manus tarzı **observe → plan → act → wait → reflect → continue/stop** döngüsünü prompt + metadata olarak standardize etmek.

---

## Turn contract

| Faz | Chat orchestrator | Run orchestrator |
|-----|-------------------|------------------|
| observe | User msg + context inject | Step input + audit |
| plan | tool-planning block | workflow step plan |
| act | tool call | tool / job |
| wait | approval / job poll | checkpoint |
| reflect | LLM synthesis | step summary |
| stop | maxIterations | terminal status |

---

## Deliverables

- [ ] `flow` section: loop pseudocode (Felix-authored)
- [ ] `chat-orchestrator` turn meta: `{ phase: "act" }` (debug/observability)
- [ ] V6 observability pro: phase histogram (opsiyonel)

---

## Başarı kriteri

- [ ] Uzun görevlerde “reflect” sonrası gereksiz ek tool call oranı düşer
