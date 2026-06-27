# 03 — Tool Calling Intelligence

> **Status:** done (MVP)  
> **Bağımlılık:** 02 Mode Profiles

---

## Amaç

Cursor/Claude/Manus tarzı **tool protokolünü** Felix’e uyarlamak — kod + prompt birlikte.

---

## Karar şeması (LLM + planner)

Her tool turn öncesi (prompt bloğu + opsiyonel structured planner):

1. **Tool gerekli mi?** — context yeterliyse hayır
2. **Intent?** — `tool-intent` classifier ile hizala
3. **Read yapıldı mı?** — write öncesi read tool veya injected context
4. **Risk seviyesi?** — tags: write, destructive, needs_approval
5. **Approval gerekir mi?** — policy + autonomy level
6. **Stop?** — yeterli sonuç varsa döngüyü kes

Mevcut: `tool-planning.js` `PLANNING_PROTOCOL`, `guardToolCall`, `isRiskyIntentMismatch`.

---

## Genişletme

- [ ] `buildToolPlanningBlock` → karar ağacı markdown + intent micro-plans (genişlet)
- [ ] `toolDecisionSchema` (opsiyonel JSON) — eval için parse
- [ ] Profile bazlı: `ops` → agent_workflow öncelik; `review` → read-only enforce
- [ ] Duplicate / loop detection mesajları prompt’ta netleştir

---

## Eval metrikleri

- Gereksiz tool call oranı
- Write öncesi read oranı
- Blocked http_request (dedicated routing) sayısı
- Approval bypass denemesi (sıfır olmalı)

---

## Başarı kriteri

- [ ] Golden trace setinde tool-call sayısı baseline’a göre ≤%20 düşüş (kalite korunarak)
