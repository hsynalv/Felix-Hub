# 07 — Prompt Eval Studio

> **Status:** not_started  
> **Bağımlılık:** V4 Eval Studio, 01 Pattern Library

---

## Amaç

10–20 prompt variant’ı aynı golden senaryolarda karşılaştırmak.

---

## Metrikler

| Metrik | Soru |
|--------|------|
| tool_noise | Gereksiz tool call var mı? |
| brain_discipline | Doğru recall/save? |
| read_before_write | Write öncesi read? |
| tr_quality | Türkçe cevap (rubric) |
| telegram_brevity | Karakter / paragraf limiti |
| spec_artifact | Spec modda doğru şablon? |

---

## Deliverables

- [ ] `eval:prompt` script veya Eval Studio sekmesi
- [ ] Fixture: mevcut `tests/eval/trace-regression` + prompt-only cases
- [ ] Rapor: variant × metric matrix (HTML/JSON)

---

## Başarı kriteri

- [ ] CI’da en az 1 prompt regression job (smoke seviyesi)
