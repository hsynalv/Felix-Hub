# 01 — Prompt Pattern Library

> **Status:** not_started  
> **Bağımlılık:** `prompt-registry` v2

---

## Amaç

Harici promptlardan türetilmiş, Felix-authored **yeniden kullanılabilir section şablonları**.

---

## Pattern taksonomisi

| Pattern | Registry section | Örnek davranış |
|---------|------------------|----------------|
| identity | `identity` | Felix + Hüseyin Alav (branding.js) |
| tool_calling | `tool_calling` | Read-before-write, vendor routing |
| planning | `flow` | Multi-step plan before act |
| memory_behavior | `memory_injection` | Explicit save triggers only |
| coding_rules | `code_style` | Edit discipline, no drive-by refactor |
| browser_desktop | custom / `capabilities` | Felix Desktop constraints |
| safety_approval | `non_compliance` + policy refs | Approval wait, no bypass |
| response_style | `response_style` | TR default, Telegram concise |
| spec_workflow | `completion_spec` + `todo_spec` | requirements/design/tasks shape |

---

## Deliverables

- [ ] `felix-core` bundle: default sections (registry prompt id)
- [ ] `patterns/` JSON: her pattern için `sectionKey`, `template`, `tags`, `provenance`
- [ ] `chat-system-prompt.js` → section’lara parçalama planı (migration checklist)
- [ ] REST: `GET /plugins/prompt-registry/sections` zaten var; pattern catalog endpoint (opsiyonel)

---

## Teknik not

`prompt-registry` `STANDARD_SECTION_KEYS` genişletilirken geriye uyumluluk: custom key’ler zaten destekleniyor; `SECTION_ORDER` güncellenir.

---

## Başarı kriteri

- [ ] Tek `prompt_render({ id: "felix-default", mode })` ile mevcut monolith’e eşdeğer çıktı (eval diff)
