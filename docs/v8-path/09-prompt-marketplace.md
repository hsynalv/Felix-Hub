# 09 — Prompt Marketplace (System Prompt Profiles)

> **Status:** done (MVP)  
> **Bağımlılık:** 02 Mode Profiles, V6 App Store (opsiyonel UI köprüsü)  
> **Backlog:** [REMAINING-WORK.md](./REMAINING-WORK.md)

---

## Amaç

Kullanıcının UI’dan davranış profili seçmesi — nötr isimlerle: **Focused Coder**, **Spec Planner**, **Ops Runbook**, **Telegram Felix**, **Felix Desktop**.

> Production prompt overlay’lerinde üçüncü taraf ürün adı kullanılmaz ([REVIEW.md](./REVIEW.md)). Paket id’leri (`felix-coder-cursor`, `felix-spec-kiro`) geriye dönük uyumluluk için korunur.

---

## MVP katalog

| Paket id | Mod | UI etiketi |
|----------|-----|------------|
| `felix-default` | agent | Felix Default |
| `felix-spec-kiro` | spec | Spec Planner |
| `felix-coder-cursor` | agent/review | Focused Coder |
| `felix-ops-v5` | ops | Ops / Runbook |
| `felix-telegram` | chat/agent | Telegram Felix |
| `felix-desktop` | desktop | Felix Desktop |

Kod: `mcp-server/src/core/chat/prompt-marketplace.js` — `GET /v8/prompt-marketplace`, Chat Instructions picker.

---

## Deliverables

- [x] Chat: “Agent behavior” / marketplace picker
- [x] `listMarketplacePacks()` + `resolveMarketplacePack()`
- [ ] Export/import bundle (settings advanced)
- [ ] V6 App Store ortak install UX

---

## Başarı kriteri

- [x] Profil değişince system prompt render değişir (marketplace overlay)
- [ ] Audit log’da `marketplacePackId` her render’da (kısmi — conversation metadata)
