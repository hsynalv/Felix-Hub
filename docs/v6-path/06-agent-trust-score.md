# 06 — Agent Trust Score

> **Status:** not_started  
> **Faz:** V6.5  
> **Bağımlılık:** [V4 Eval Studio](../v4-path/08-eval-studio.md), [01-multi-agent-collaboration.md](./01-multi-agent-collaboration.md)

---

## Amaç

Her agent/workflow için ölçülebilir güven skoru — kurumsal ve premium görünüm.

---

## Skor bileşenleri

- Başarı oranı
- Ortalama maliyet
- Approval reject oranı
- Test pass oranı
- Rollback ihtiyacı
- Kullanıcı müdahalesi sayısı

---

## UI örneği

```text
Self-Healing Dev Agent: 87/100 trust
Desktop Control Agent: 61/100 trust
```

---

## Kapsam

- [ ] Trust score hesaplama job (per agent, per skill, per workflow)
- [ ] Skor geçmişi + trend
- [ ] Policy hook: düşük trust → ekstra approval
- [ ] App Store / Skill Store'da trust badge
- [ ] Watchers: düşük trust skill otomatik run açmaz (configurable)

---

## Başarı kriteri

- [ ] Her yayınlanmış agent/skill için güncel trust skoru görünür
- [ ] Skor bileşenleri drill-down ile incelenebilir

---

## Sonraki

[07-sandbox-simulation-lab.md](./07-sandbox-simulation-lab.md)
