# 08 — Environment Promotion & Change Control

> **Status:** done  
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

- [x] Environment registry (dev/staging/prod per project)
- [x] Promotion request workflow
- [x] Config diff API (masked secrets)
- [x] Approval chain (multi-step)
- [x] Deployment checklist runbook entegrasyonu
- [x] Rollback requirement flag
- [x] Policy: production destructive tools blocked by default

---

## Başarı kriteri

- [x] Staging → prod promotion change request + approval chain gerektirir
- [x] Config diff secret değerlerini göstermeden farkları listeler

---

## Sonraki

V5 tamamlandı → [V6 path](../v6-path/README.md)
