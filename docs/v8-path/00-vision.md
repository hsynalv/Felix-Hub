# 00 — V8 Vision: Prompt Intelligence & Agent Behavior

> **Status:** not_started  
> **Önkoşul:** V4 Eval Studio + `prompt-registry` v2, V6 operating model, V7 chat channels (kısmi)  
> **Kaynak arşiv:** [SOURCE-ARCHIVE.md](./SOURCE-ARCHIVE.md) (`system-prompts-and-models-of-ai-tools/`)

---

## Amaç

Harici agent prompt arşivlerinden **ham metin kopyalamadan**, Felix Hub için öğrenilmiş **davranış kalıpları** çıkarmak ve bunları üretim chat/agent döngüsüne bağlamak.

V8, “daha uzun system prompt” değil — **doğru modda, doğru bölümde, ölçülebilir davranış** demektir.

---

## Temel ilkeler

1. **Derived patterns, not dumps** — Cursor/Claude/Manus metinleri referans; Felix identity (`branding.js`) korunur.
2. **Registry-first** — `chat-system-prompt.js` monolith zamanla `prompt-registry` section’larına taşınır.
3. **Profile → prompt render** — `chat-profiles` hangi mod; registry hangi section’ları birleştirir.
4. **Code enforces, prompt guides** — `tool-planning.js`, `guardToolCall`, policy/approval kodda; prompt sadece LLM’i hizalar.
5. **Eval or it didn’t happen** — V4 Eval Studio ile A/B; golden trace + prompt regression.
6. **Provenance always** — her imported pattern: kaynak, risk etiketi, türetme notu.

---

## Mevcut zemin (kod)

| Bileşen | Konum | V8’de rol |
|---------|-------|-----------|
| Section composer | `plugins/prompt-registry/` | Pattern library storage + render |
| Mod enum | `MODES = agent, spec, review, debug, chat` | Genişletilecek: `ops`, `desktop` |
| Chat profiles | `core/chat/chat-profiles.js` | Profile ↔ mode ↔ registry binding |
| System prompt | `core/chat/chat-system-prompt.js` | Parçalanacak → registry sections |
| Tool planning | `core/chat/tool-planning.js` | Karar şeması genişletilecek |
| Intent / guard | `tool-intent.js`, `guardToolCall` | Profile + planning ile sıkılaşacak |
| Eval | `core/eval/`, Eval Studio UI | Prompt A/B suite |
| Agent loop | `chat-orchestrator.js`, run orchestrator | Observe–plan–act contract |

---

## Başarı kriteri (V8 exit)

- [ ] Chat turn system prompt’u `prompt_render` ile üretilir (fallback: legacy monolith)
- [ ] En az 7 mod profili registry’de tanımlı ve UI’dan seçilebilir
- [ ] Tool planning bloğu karar ağacı (need tool / intent / read-before-write / approval) içerir
- [ ] Spec workflow: requirements → design → tasks artifact üretir
- [ ] Importer: arşivden ≥1 draft pattern, provenance etiketli
- [ ] Eval: ≥3 prompt variant karşılaştırması CI veya `eval:prompt` ile

---

## Sonraki

[01-prompt-pattern-library.md](./01-prompt-pattern-library.md)
