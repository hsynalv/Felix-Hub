# 02 — Daily Briefing Agent

> **Status:** `mvp_done` — hub-native briefing + feedback  
> **Production:** `pending` — IMAP/RSS connectors, schedule, dedup → [POST-MVP-BACKLOG](./POST-MVP-BACKLOG.md#1-briefing-source-connectors-72-prod)
> **Faz:** V7.2  
> **Bağımlılık:** [01-personal-command-center.md](./01-personal-command-center.md), [07-personal-memory-profile.md](./07-personal-memory-profile.md)

---

## Amaç

Mail, haber kaynakları, RSS, GitHub, Notion, Obsidian ve seçili web kaynaklarından **düzenli özet** üretmek.

---

## Kaynaklar

- Gmail / IMAP
- RSS feed
- Haber siteleri
- GitHub notifications
- Product Hunt
- Hacker News
- Reddit
- Notion task/project updates
- Obsidian daily notes
- Custom web kaynakları

---

## Çıkış kanalları

- Telegram
- Web dashboard (Command Center)
- Email digest
- Obsidian daily note
- Notion page

---

## Örnek kullanım

```text
Her sabah 09:00'da AI, yazılım, ekonomi ve önemli maillerimi özetle.
Sadece aksiyon gerektirenleri Telegram'dan bildir.
```

---

## Özellikler

- Kaynak bazlı filtre
- Önem skoru
- Duplicate haber temizleme
- Kısa / detaylı özet modu
- "Bunu bir daha gösterme" feedback
- "Bu kaynağı daha çok takip et" feedback

---

## Kapsam

### MVP (done)

- [mvp] Hub-native kaynaklar: inbox, runs, projects, pinned memory (`briefing-sources.js`)
- [mvp] `generateDailyBriefing` + Command Center / `/brief`
- [mvp] Importance scoring (hub sinyalleri)
- [mvp] Feedback loop (`relevant` / `show_less` / `not_relevant`)
- [mvp] Feedback → sonraki brifing sıralaması

### Production (pending)

- [prod] Source connector registry: RSS, IMAP/Gmail — **registry + poll MVP (Sprint 1)**
- [prod] Connector health UI (`not_configured` → `active`)
- [prod] Duplicate haber temizleme (cross-source)
- [prod] Schedule: sabah 09:00 otomatik generate + Telegram push
- [prod] Multi-channel delivery (email digest, Obsidian note)
- [prod] Life agent profili: `news-briefing` → gerçek RSS poll

---

## Başarı kriteri

- [mvp] Web/Telegram'dan manuel brifing üretilebilir
- [prod] Telegram'a her gün otomatik, kaynak bağlı, aksiyon odaklı brifing gelir

---

## Sonraki

[03-telegram-remote-control.md](./03-telegram-remote-control.md)
