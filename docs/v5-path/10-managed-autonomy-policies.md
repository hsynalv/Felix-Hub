# 10 — Managed Autonomy Policies

> **Status:** done  
> **Faz:** V5.3  
> **Bağımlılık:** [V4 Approval Center Pro](../v4-path/04-approval-center-pro.md), [V4 Cost Guardrails](../v4-path/09-cost-quota-policy-guardrails.md)

---

## Amaç

V3/V4 policy action approval odaklı; V5'te **autonomy seviyesi** açıkça yönetilir — tüm runbook, schedule ve agent'ların çerçevesi.

---

## Autonomy levels

```text
L0 observe only
L1 suggest
L2 act with approval
L3 act within project policy
L4 scheduled autonomous
L5 production autonomous with escalation
```

---

## Policy örnekleri

- "Staging'de dependency update PR açabilir."
- "Production'da sadece read-only analiz yapabilir."
- "Desktop control sadece approve ile."
- "Cost $1 üstüyse dur."
- "3 kez fail olursa human'a escalate et."

---

## Kapsam

- [x] Autonomy level model (per project, env, runbook, schedule)
- [x] Policy DSL veya structured rules
- [x] Runtime enforcement: run spawn + step execution
- [x] UI: autonomy matrix (env × tool class)
- [x] L4/L5 için SLA escalation zorunluluğu (schedule policy + workflow step gate)
- [x] Audit: autonomy level değişiklikleri

---

## Başarı kriteri

- [x] Production'da L1 agent destructive tool çağıramaz
- [x] Schedule L4 ile çalışırken max cost ve escalation policy uygulanır

---

## Sonraki

[03-release-manager-agent.md](./03-release-manager-agent.md)
