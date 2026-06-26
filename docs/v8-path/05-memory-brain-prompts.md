# 05 — Memory / Brain Prompt Hardening

> **Status:** not_started  
> **Bağımlılık:** 01 Pattern Library, brain plugin

---

## Amaç

Cursor tarzı net memory kuralları — mevcut `brain_*` limitleri ile uyumlu prompt.

---

## Kurallar (prompt contract)

- **Create:** yalnızca explicit “hatırla/kaydet/remember” veya yüksek önemli karar
- **Recall:** personal/project sorularda önce recall; chat history yeterli değil
- **Update:** çelişen bilgi → `brain_update_memory` / forget+remember akışı
- **Delete:** kullanıcı “unut” derse `brain_forget`
- **Citation:** `[memory:id]` formatı; “nereden biliyorsun?” sorusuna id+scope
- **Confidence:** stale/low-confidence bellekte uyarı dili (V6 conflict resolver ile köprü)

Mevcut kod: `chat-system-prompt.js` brain bölümü + turn limitleri.

---

## Deliverables

- [ ] `memory_injection` section registry’de ayrı bundle
- [ ] Profile: `personal_assistant` → brain_save intent açık; `research` → recall only
- [ ] Eval: brain over-save / under-recall senaryoları

---

## Başarı kriteri

- [ ] Eval setinde yanlış `brain_remember` oranı baseline’a göre düşer
