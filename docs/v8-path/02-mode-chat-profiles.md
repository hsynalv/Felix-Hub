# 02 — Mode-Based Chat Profiles

> **Status:** not_started  
> **Bağımlılık:** 01 Pattern Library

---

## Amaç

Kiro **Do / Spec / Chat** ayrımını Felix Hub’a taşımak: profil → mod → registry render → tool policy.

---

## Mod matrisi

| Mod | Kullanım | Mevcut profil (yakın) | Write tools | Max iter |
|-----|----------|------------------------|-------------|----------|
| `chat` | Sohbet, açıklama | `answer_only`, `balanced` | opsiyonel | 1–3 |
| `agent` | İş yap, tool kullan | `balanced`, `high_autonomy` | evet | 8 |
| `spec` | requirements/design/tasks | *(yeni)* | hayır / draft only | 4 |
| `review` | Kod incele | `code_editing` (read) | hayır | 4 |
| `debug` | Hata çöz | `code_editing` | sınırlı | 6 |
| `ops` | Runbook/incident/release | `automation` | policy | 8 |
| `desktop` | Felix Desktop (V7) | *(yeni)* | approval-heavy | 6 |

`prompt-registry` `MODES` dizisine `ops`, `desktop` eklenir.

---

## Bağlantı modeli

```text
UI / API profileId
  → chat-profiles.js (toolIntents, allowWriteTools, maxIterations)
  → prompt-registry mode + bundleId
  → buildSystemPrompt({ registryRender: true })
  → tool-planning block (intent-aware)
```

---

## Deliverables

- [ ] `CHAT_PROFILES` genişletme veya `mode` alanı + `promptBundleId`
- [ ] Chat UI: mod seçici (Spec / Agent / Chat toggle)
- [ ] `resolveChatProfile` → `resolvePromptBundle(profile)`
- [ ] Telegram: `TELEGRAM_CHAT_PROFILE` → `telegram` response_style section

---

## Başarı kriteri

- [ ] Aynı kullanıcı sorusu `spec` modda tool çağırmadan artifact üretir; `agent` modda tool çağırır
