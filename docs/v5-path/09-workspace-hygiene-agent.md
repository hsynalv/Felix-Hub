# 09 — Workspace Automation Hygiene

> **Status:** not_started  
> **Faz:** V5.6  
> **Bağımlılık:** [02-scheduled-agent-operations.md](./02-scheduled-agent-operations.md), [V4 Project Command Center](../v4-path/05-project-command-center.md)

---

## Amaç

Agent çok iş yaptıkça ortalık kirlenir — platformu sürekli temiz tutan hygiene agent.

---

## Yapabilecekleri

- Eski branch'leri bul
- Stale PR'ları listele
- TODO/FIXME taraması
- Eski Notion task sync
- Obsidian orphan notes
- Unused secrets
- Dead workflows
- Failed runs cleanup

---

## Örnek schedule

```text
Her pazartesi 09:00 → hygiene runbook
→ stale PR > 30 gün → rapor + opsiyonel kapatma önerisi
→ failed runs > 90 gün → arşiv
```

---

## Kapsam

- [ ] Hygiene runbook preset + checklist
- [ ] GitHub: stale PR, eski branch
- [ ] Workspace: TODO/FIXME scan
- [ ] Notion/Obsidian sync drift
- [ ] Secrets catalog: unused detection (heuristic)
- [ ] Dead workflow / failed run cleanup (policy-gated)
- [ ] Hygiene report → 06 briefings formatı

---

## Başarı kriteri

- [ ] Haftalık hygiene raporu stale PR ve eski branch listesi içerir
- [ ] Destructive cleanup (branch delete) approval gerektirir

---

## Sonraki

[06-agent-reports-briefings.md](./06-agent-reports-briefings.md) (rapor entegrasyonu)
