# 07 — Sandbox / Simulation Lab

> **Status:** not_started  
> **Faz:** V6.4  
> **Bağımlılık:** [V4 Eval Studio](../v4-path/08-eval-studio.md), [V4 Runtime v2 dry-run](../v4-path/02-agent-runtime-v2.md)

---

## Amaç

Riskli workflow'ları gerçek ortam yerine simüle etmek.

---

## Mock katmanları

- Fake filesystem
- Fake GitHub repo
- Fake DB
- Mock browser
- Mock desktop screenshot
- Mock Notion workspace

Run Designer + Eval Studio için yüksek değer: güvenli deneme ve regression.

---

## Kapsam

- [ ] Sandbox session modeli (`sandbox_id`, TTL, fixtures)
- [ ] Tool router: sandbox modda mock adapter
- [ ] Fixture import/export (JSON)
- [ ] Run Designer: "Run in sandbox" toggle
- [ ] Eval Studio: sandbox golden trace
- [ ] Sandbox → production promote checklist

---

## Başarı kriteri

- [ ] Destructive workflow sandbox'ta gerçek kaynağa dokunmadan tamamlanır
- [ ] Sandbox run ile production run diff karşılaştırılabilir

---

## Sonraki

[08-agent-app-store.md](./08-agent-app-store.md)
