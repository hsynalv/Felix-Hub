# 08 — Environment Promotion & Change Control

> **Status:** not_started  
> **Faz:** V5.10  
> **Bağımlılık:** [10-managed-autonomy-policies.md](./10-managed-autonomy-policies.md), [01-runbook-automation.md](./01-runbook-automation.md)

---

## Amaç

Premium B2B özellik: dev/staging/prod ayrımı ve kontrollü promotion — mevcut `x-project-id` / `x-env` modelinin ürünleşmiş hali.

---

## Özellikler

- Dev → staging → production promotion
- Production'da stricter policy
- Change request
- Approval chain
- Config diff
- Secret diff without revealing values
- Deployment checklist
- Rollback requirement

---

## Autonomy × environment

| Ortam | Tipik autonomy |
|-------|----------------|
| dev | L3–L4 |
| staging | L2–L3 |
| production | L1–L2 (analiz) veya L2 + chain approval (deploy) |

---

## Kapsam

- [ ] Environment registry (dev/staging/prod per project)
- [ ] Promotion request workflow
- [ ] Config diff API (masked secrets)
- [ ] Approval chain (multi-step)
- [ ] Deployment checklist runbook entegrasyonu
- [ ] Rollback requirement flag
- [ ] Policy: production destructive tools blocked by default

---

## Başarı kriteri

- [ ] Staging → prod promotion change request + approval chain gerektirir
- [ ] Config diff secret değerlerini göstermeden farkları listeler

---

## Sonraki

V5 tamamlandı → [V6 path](../v6-path/README.md)
