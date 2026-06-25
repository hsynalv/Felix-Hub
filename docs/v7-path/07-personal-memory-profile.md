# 07 — Personal Memory Profile

> **Status:** partial ([V6 Personal Operating Model](../v6-path/10-personal-operating-model.md), workspace prefs)  
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

- [ ] `personal_memory` store (scoped: global / project)
- [ ] remember/forget/pin API + MCP tools
- [ ] `why_do_you_know_this` attribution UI
- [ ] Briefing + life agent prompt injection
- [ ] Telegram memory komutları
- [ ] Export / GDPR delete

---

## Başarı kriteri

- [ ] Agent zamanla daha kişisel davranır ama neyi neden bildiği şeffaftır

---

## Sonraki

[04-browser-desktop-assistant.md](./04-browser-desktop-assistant.md) (Faz 2)
