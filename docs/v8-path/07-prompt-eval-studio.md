# 07 — Prompt Eval Studio

> **Status:** done (MVP)  
> **Bağımlılık:** V4 Eval Studio, 01 Pattern Library  
> **Backlog:** [REMAINING-WORK.md](./REMAINING-WORK.md) §3 (LLM golden suite, CI gate)

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

- [x] `eval:prompt` script + Eval Studio “Prompt eval” sekmesi (heuristic smoke)
- [x] `eval:prompt:llm` stub + `tests/eval/conversations/` golden dizini
- [ ] Fixture: gerçek LLM golden JSON senaryoları
- [ ] Rapor: variant × metric matrix (HTML/JSON)

---

## Başarı kriteri

- [x] CI smoke: `eval:prompt` (heuristic)
- [ ] CI LLM regression job (`OPENAI_API_KEY` gated)
