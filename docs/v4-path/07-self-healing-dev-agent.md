# 07 — Self-Healing Dev Agent

> **Status:** not_started  
> **Faz:** V4.7  
> **Bağımlılık:** [02-agent-runtime-v2.md](./02-agent-runtime-v2.md), [03-agent-run-designer.md](./03-agent-run-designer.md), [04-approval-center-pro.md](./04-approval-center-pro.md)

---

## Amaç

Kod projelerinde gerçek premium değer yaratmak.

---

## Kapsam

- CI/test failure yakala.
- Log analiz et.
- İlgili dosyaları bul.
- Fix planı çıkar.
- Değişiklik yap.
- Test koş.
- PR hazırla.
- Run timeline + diff + maliyet göster.

---

## Workflow örneği

```text
test failure → analyze logs → inspect files → patch → run tests → summarize → open PR
```

---

## Entegrasyonlar

- GitHub
- git
- shell/tests
- workspace
- code-review
- agent-runs
- approval center

---

## Başarı kriteri

- [ ] Basit failing test'i end-to-end düzeltebilen agent run

---

## Sonraki

[08-eval-studio.md](./08-eval-studio.md)
