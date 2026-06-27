# 04 — Spec Driven Development

> **Status:** done (MVP)  
> **Bağımlılık:** 02 Mode (`spec`), V3–V7 path docs

---

## Amaç

Kiro Spec akışını ürünleştirmek: fikir → plan → tasarım → görevler → (opsiyonel) agent run / runbook.

---

## Akış

```text
Kullanıcı: "şunu ekle"
  → requirements.md (scope, acceptance)
  → design.md (architecture, risks)
  → tasks.md (checkbox list, deps)
  → docs/v*-path/ veya proje docs/ altına kayıt
  → agent_workflow_create / runbook (V5) ile uygulama
```

---

## Entegrasyon

- `spec` mod prompt: `completion_spec` + `todo_spec` sections
- Artifact store: `cache/spec-sessions/` veya MSSQL (V6 persistence path)
- UI: Chat’te “Spec moduna geç” + artifact preview
- V6 NL Admin: `spec` intent → aynı pipeline

---

## Deliverables

- [ ] `spec_session` entity + API (`POST /spec/sessions`, `POST /spec/advance`)
- [ ] Şablonlar: requirements / design / tasks (Felix-authored)
- [ ] Export: markdown zip veya Notion/Obsidian push

---

## Başarı kriteri

- [ ] Örnek feature request → 3 artifact + en az 1 workflow draft üretilir
