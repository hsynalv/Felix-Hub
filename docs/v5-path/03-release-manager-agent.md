# 03 — Release Manager Agent

> **Status:** done  
> **Faz:** V5.4  
> **Bağımlılık:** [V4 Self-Healing Dev Agent](../v4-path/07-self-healing-dev-agent.md), [01-runbook-automation.md](./01-runbook-automation.md)

---

## Amaç

Self-healing'in release tarafı — PR gruplama, changelog, semver ve GitHub release hazırlığı.

---

## Yapabilecekleri

- PR'ları gruplar
- Changelog üretir
- Semver önerir
- Migration risklerini çıkarır
- Test checklist hazırlar
- Release branch açar
- Draft GitHub release oluşturur
- Rollback notu üretir

---

## Örnek runbook akışı

```text
merged PRs since tag → group by area → changelog draft
→ migration risk scan → test checklist → semver bump öner
→ approval → release branch → draft GitHub release
```

---

## Kapsam

- [x] Release Manager workflow template / runbook preset
- [x] GitHub: PR list, release API, draft release
- [x] Migration risk heuristic (DB, breaking API)
- [x] Changelog formatları (keep a changelog, conventional)
- [x] Approval gate: production release
- [x] Rollback note template

---

## Başarı kriteri

- [x] Son tag'den bu yana merge'ler için changelog + semver önerisi üretilir
- [x] Onay sonrası draft GitHub release oluşturulur

---

## Sonraki

[05-maintenance-agent.md](./05-maintenance-agent.md)
