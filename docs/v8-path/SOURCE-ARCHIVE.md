# Kaynak Arşiv — `system-prompts-and-models-of-ai-tools`

> **Konum:** repo kökünde `system-prompts-and-models-of-ai-tools/` (ayrı git submodule/klon)  
> **Lisans:** GPL-3.0 (`LICENSE.md`) — **birebir kopyalama ürün prompt’una taşınmaz**

---

## Ne içerir

Cursor, Claude Code, Codex CLI, Manus, Kiro, Windsurf, Qoder, Devin, Replit, Lovable vb. için sızdırılmış / açık kaynak **system prompt** ve tool tanımı örnekleri.

---

## Felix Hub kullanım politikası

| Yapılır | Yapılmaz |
|---------|----------|
| Pattern çıkarımı (tool protocol, spec flow, memory rules) | Vendor prompt’unu olduğu gibi `prompt-registry`’ye yapıştırma |
| “Inspired by Cursor tool loop” gibi provenance notu | Identity bölümünde üçüncü parti marka adı kullanma |
| İç araştırma / eval dataset (private) | GPL metnini kapalı ürün prompt’u olarak dağıtma |
| Felix-authored section’lar yazarken fikir alma | Kullanıcıya “sen Cursor’sun” demek |

**Pratik kural:** Arşiv → analiz notu → Felix pattern spec → `prompt-registry` draft → insan review → eval → publish.

---

## Pattern çıkarım matrisi

Harici promptlardan Felix `STANDARD_SECTION_KEYS` eşlemesi:

| Felix section | Arşivden tipik içerik |
|---------------|----------------------|
| `identity` | Asistan kimliği — **yalnızca Felix branding** |
| `capabilities` | Hangi araçlar / sınırlar |
| `flow` | Agent loop, plan–act–reflect |
| `tool_calling` | Read-before-write, stop conditions, parallel rules |
| `response_style` | Kısa/uzun, Türkçe, Telegram |
| `code_style` | Edit format, citation, test discipline |
| `context_understanding` | Repo/workspace awareness |
| `memory_injection` | When to save/recall/update/delete |
| `preferences_injection` | Operating model / user prefs |
| `completion_spec` | Output shape, markdown rules |
| `non_compliance` | Refusal, safety |
| `todo_spec` | Task list / checklist behavior |

Ek V8 pattern etiketleri (metadata): `planning`, `browser_desktop`, `safety_approval`, `spec_workflow`.

---

## Öncelikli kaynaklar (ilk tarama)

| Kaynak | Değer | Felix hedefi |
|--------|-------|--------------|
| Kiro `Spec_Prompt.txt` | Spec-driven flow | [04-spec-driven-development.md](./04-spec-driven-development.md) |
| Cursor Agent prompts | Tool + edit protocol | [03-tool-calling-intelligence.md](./03-tool-calling-intelligence.md) |
| Manus `Prompt.txt` | Long-running loop | [06-agent-loop-contract.md](./06-agent-loop-contract.md) |
| Claude Code | Concise engineering | `review` / `agent` mode sections |
| Windsurf / Trae | IDE context | `code_editing` profile |
| Comet / browser agents | Desktop rules | V7 `desktop` mode (V8 section) |

---

## Importer hedef dizini

```
mcp-server/cache/prompt-intelligence/
  sources/          # analiz özeti (metin değil, pattern notes)
  drafts/           # registry-import-ready JSON
  provenance.json   # source file → pattern id → risk
```

Detay: [08-prompt-importer.md](./08-prompt-importer.md)
