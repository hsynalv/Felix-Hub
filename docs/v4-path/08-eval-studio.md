# 08 — Eval Studio

> **Status:** done  
> **Faz:** V4.8  
> **Bağımlılık:** [02-agent-runtime-v2.md](./02-agent-runtime-v2.md), [03-agent-run-designer.md](./03-agent-run-designer.md)

---

## Amaç

Agent davranışını ölçülebilir ve regresyona dayanıklı hale getirmek.

---

## Kapsam

- Golden trace yönetimi.
- Workflow replay compare.
- Prompt/model/provider karşılaştırma.
- Tool-call accuracy.
- Cost/latency/quality skorları.
- CI gate.
- "Bu değişiklik agent davranışını bozdu mu?" raporu.

---

## Test türleri

```text
trace regression
tool selection eval
prompt regression
workflow outcome eval
cost regression
latency regression
```

---

## Başarı kriteri

- [x] Bir workflow template değişince kalite farkı ölçülebilir
- [x] CI'da kritik agent regression yakalanır

---

## Stratejik not

Eval Studio, **stratejik üçlünün** bir parçası (Designer + Desktop + Eval).

---

## Sonraki

[09-cost-quota-policy-guardrails.md](./09-cost-quota-policy-guardrails.md)
