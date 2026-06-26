# 09 — Jarvis Interface

> **Status:** `mvp_done` — modes, SSE, overlay, voice bar, mobile approval  
> **Production:** `pending` — voice out polish, notification center depth
> **Faz:** V7.10  
> **Bağımlılık:** [01-personal-command-center.md](./01-personal-command-center.md), [03-telegram-remote-control.md](./03-telegram-remote-control.md), [04-browser-desktop-assistant.md](./04-browser-desktop-assistant.md)

---

## Amaç

Sisteme **premium kişisel assistant** hissi veren çok kanallı arayüz.

---

## Kanallar

- Web UI
- Telegram
- Desktop overlay
- Voice input
- Voice output
- Notification center
- Mobile-friendly approval

---

## Modlar

```text
Work Mode
Personal Mode
Research Mode
Shopping Mode
Coding Mode
Away Mode
Focus Mode
```

Mod değişimi autonomy preset'lerini ve görünür widget'ları etkiler.

---

## UI parçaları

- Live agent status
- "Şu an ne yapıyor?" paneli
- Run timeline
- Approval overlay
- Daily briefing screen
- Voice command bar
- Quick actions
- Emergency stop

---

## Kapsam

- [x] Mode switcher (global — Bugün + API)
- [x] Live status API + SSE (`/personal/jarvis/live`, `/events`)
- [x] Desktop overlay MVP (sidecar companion)
- [x] Voice in/out (chat voice özelliği genişletme)
- [x] Quick actions bar (brief, stop, approve next)
- [x] Mobile approval responsive polish

---

## Başarı kriteri

- [x] Kullanıcı agent'ı sadece chat kutusundan değil, Telegram/web quick actions üzerinden yönetebilir

---

## Sonraki

Faz 4 olgunlaştırma → [EXECUTION-ORDER.md](./EXECUTION-ORDER.md)
