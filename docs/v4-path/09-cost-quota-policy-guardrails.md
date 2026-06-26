# 09 — Cost, Quota ve Policy Guardrails

> **Status:** done  
> **Faz:** V4.9  
> **Bağımlılık:** [04-approval-center-pro.md](./04-approval-center-pro.md), [08-eval-studio.md](./08-eval-studio.md) (paralel başlanabilir)

---

## Amaç

Agent çalıştırma maliyetini ve riskini kontrol altına almak.

---

## Kapsam

- Proje bazlı budget.
- Agent/run bazlı maliyet.
- Provider bazlı kırılım.
- Preflight cost estimate.
- Cost anomaly alert.
- Ucuz modele fallback.
- Quota aşınca stop/approval.
- Policy + cost birleşimi.

---

## Örnek kural

```text
Production project için destructive tool + estimatedCost > $2 ise admin approval gerekir.
```

---

## Başarı kriteri

- [x] Kullanıcı her run'ın maliyetini ve riskini önceden görebilir
- [x] Bütçe aşımı otomatik engellenir

---

## Sonraki

[10-team-marketplace-packs.md](./10-team-marketplace-packs.md)
