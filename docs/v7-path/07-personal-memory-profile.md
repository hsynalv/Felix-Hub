# 07 — Personal Memory Profile

> **Status:** `mvp_done` — CRUD, explain, Telegram, briefing injection  
> **Production:** `pending` — encrypted persistence, multi-device → [POST-MVP-BACKLOG](./POST-MVP-BACKLOG.md#7-v7-personal-layer-persistence-encryption-backup)
> **Faz:** V7.4  
> **Bağımlılık:** [V4 workspace preferences](../v4-path/05-project-command-center.md)

---

## Amaç

Agent'ın kullanıcı tercihlerini **yönetilebilir şekilde** hatırlaması.

---

## Hatırlanacak alanlar

- Haber kaynakları
- Mail öncelikleri
- Kodlama tercihleri
- Alışveriş tercihleri
- Takvim alışkanlıkları
- Günlük brifing formatı
- Sevilen/sevilmeyen kaynaklar
- Proje öncelikleri
- Risk toleransı
- Telegram cevap stili

---

## Memory komutları

```text
remember
forget
pin
edit
scope_to_project
scope_to_personal
show_memory
why_do_you_know_this
```

---

## Güvenlik

- Hassas bilgiler explicit onay olmadan memory'ye yazılmaz
- Memory kaynak bilgisi tutulur
- Kullanıcı her memory item'ı silebilir/düzeltebilir
- Personal ve project memory ayrıdır

---

## Kapsam

### MVP (done)

- [mvp] remember/forget/pin API + MCP tools
- [mvp] `why_do_you_know_this` / explain attribution UI
- [mvp] Briefing + life agent prompt injection
- [mvp] Telegram memory komutları
- [mvp] Export / GDPR delete

### Production (pending)

- [prod] Encrypted at-rest store (vs JSON cache)
- [prod] Multi-device sync + conflict resolution
- [prod] Backup/restore for personal layer

---

## Başarı kriteri

- [x] Agent zamanla daha kişisel davranır ama neyi neden bildiği şeffaftır

---

## Sonraki

[04-browser-desktop-assistant.md](./04-browser-desktop-assistant.md) (Faz 2)
