# V8 Path — Prompt Intelligence & Agent Behavior Layer

> **Ürün yönü:** Harici agent prompt arşivinden **öğrenilmiş davranış** → Felix Hub chat, agent run ve eval  
> **Değer önerisi:** “LLM kafasına göre tool çağırıyor” hissini azaltmak; mod bazlı, ölçülebilir, Felix kimlikli agent deneyimi

Önkoşul: [V4 Eval Studio](../v4-path/08-eval-studio.md), [V6 operating model](../v6-path/10-personal-operating-model.md). Sıra: [EXECUTION-ORDER.md](./EXECUTION-ORDER.md).

---

## Strateji özeti

```text
V3–V6: Platform + ekosistem omurgası
V7:    Personal AI OS (kanal + desktop)
V8:    Prompt intelligence — registry, modlar, spec, eval, importer
```

**Kritik:** `system-prompts-and-models-of-ai-tools/` → [SOURCE-ARCHIVE.md](./SOURCE-ARCHIVE.md) politikası; dump yok, pattern var.

---

## On pillar

| # | Dosya | Odak |
|---|-------|------|
| 00 | [00-vision.md](./00-vision.md) | İlkeler, mevcut kod haritası |
| — | [SOURCE-ARCHIVE.md](./SOURCE-ARCHIVE.md) | Arşiv kullanım / GPL / provenance |
| 01 | [01-prompt-pattern-library.md](./01-prompt-pattern-library.md) | Section pattern kütüphanesi |
| 02 | [02-mode-chat-profiles.md](./02-mode-chat-profiles.md) | chat/agent/spec/review/debug/ops/desktop |
| 03 | [03-tool-calling-intelligence.md](./03-tool-calling-intelligence.md) | Tool karar şeması |
| 04 | [04-spec-driven-development.md](./04-spec-driven-development.md) | Kiro-style spec → tasks → run |
| 05 | [05-memory-brain-prompts.md](./05-memory-brain-prompts.md) | Brain create/update/delete kuralları |
| 06 | [06-agent-loop-contract.md](./06-agent-loop-contract.md) | observe–plan–act–reflect |
| 07 | [07-prompt-eval-studio.md](./07-prompt-eval-studio.md) | Prompt A/B regression |
| 08 | [08-prompt-importer.md](./08-prompt-importer.md) | Arşiv tarayıcı → registry draft |
| 09 | [09-prompt-marketplace.md](./09-prompt-marketplace.md) | Focused Coder / Spec Planner profiller |
| 10 | [10-provenance-safety.md](./10-provenance-safety.md) | Lisans, risk, review |

---

## Mevcut kod kancaları

- `mcp-server/src/plugins/prompt-registry/` — `STANDARD_SECTION_KEYS`, `MODES`, `prompt_render`
- `mcp-server/src/core/chat/chat-profiles.js` — profil → intent; V8’de `promptBundleId` eklenir
- `mcp-server/src/core/chat/chat-system-prompt.js` — migrate hedefi
- `mcp-server/src/core/chat/tool-planning.js` — genişletilecek protocol
- `mcp-server/src/core/branding.js` — Felix identity (değişmez çekirdek)

---

## Nasıl kullanılır

1. [EXECUTION-ORDER.md](./EXECUTION-ORDER.md) — aktif fazı seç
2. Pillar maddelerini issue/PR’lara böl
3. Her pattern için provenance + eval notu ekle
4. `Status:` satırını güncelle — bkz. [HARDENING-NOTES.md](./HARDENING-NOTES.md)

İlgili: [v7-path](../v7-path/README.md), [v4-path](../v4-path/README.md), [v6-path](../v6-path/README.md).
