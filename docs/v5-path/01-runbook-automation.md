# 01 — Runbook Automation

> **Status:** not_started  
> **Faz:** V5.1  
> **Bağımlılık:** [V4 Run Designer](../v4-path/03-agent-run-designer.md), [V4 Runtime v2](../v4-path/02-agent-runtime-v2.md)

---

## Amaç

V4 workflow designer'daki şablonları **operasyonel runbook**'a yükseltmek — incident, release, bakım gibi tekrarlanan süreçler için.

---

## Runbook türleri

- Incident runbook
- Release runbook
- CI fix runbook
- Dependency update runbook
- Security patch runbook
- Daily project hygiene runbook

---

## Özellikler

- Runbook versioning
- Required approvals
- Preflight checks
- Rollback plan
- Owner
- SLA
- Post-run report

---

## Teknik model

```text
runbook = workflow_template + ops_metadata
  version, owner, sla_minutes, rollback_template_id
  preflight_checks[], required_approvals[]
  post_run_report_template
```

---

## Kapsam

- [ ] `runbooks` tablosu + CRUD API
- [ ] Runbook → workflow template bağlantısı
- [ ] Preflight check runner (policy, env, cost estimate)
- [ ] Runbook UI: katalog, versiyon geçmişi, çalıştır
- [ ] Post-run report otomatik üretimi
- [ ] Audit: hangi runbook kim tarafından ne zaman

---

## Başarı kriteri

- [ ] "CI fix runbook" versiyonlu kayıt altında tekrar çalıştırılabilir
- [ ] Preflight fail olunca run başlamaz, rapor üretilir

---

## Sonraki

[02-scheduled-agent-operations.md](./02-scheduled-agent-operations.md)
