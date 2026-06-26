# 09 — Prompt Marketplace (System Prompt Profiles)

> **Status:** not_started  
> **Bağımlılık:** 02 Mode Profiles, V6 App Store (opsiyonel UI köprüsü)

---

## Amaç

Kullanıcının UI’dan davranış profili seçmesi — “Cursor-like coder”, “Kiro spec”, “Manus long-run”, “Telegram Felix”, “Jarvis desktop”.

---

## MVP katalog (örnek)

| Paket id | Mod | Açıklama |
|----------|-----|----------|
| `felix-default` | agent | Dengeli Felix |
| `felix-spec-kiro` | spec | Spec workflow |
| `felix-coder-cursor` | agent/review | Coding + review |
| `felix-ops-v5` | ops | Runbook/incident |
| `felix-telegram` | chat/agent | Kısa, tool-disiplinli |
| `felix-desktop` | desktop | Felix Desktop kuralları |

V6 App Store ile ortak install/uninstall UX düşünülebilir; veri modeli `prompt-registry` prompt kayıtları.

---

## Deliverables

- [ ] Settings veya Chat: “Agent behavior” picker
- [ ] `prompt_list?tag=marketplace`
- [ ] Export/import bundle (settings advanced)

---

## Başarı kriteri

- [ ] Kullanıcı profil değiştirince aynı oturumda system prompt render değişir (audit log)
