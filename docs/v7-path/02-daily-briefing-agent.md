# 02 — Daily Briefing Agent

> **Status:** partial  
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

- [ ] Briefing agent workflow / life agent profili
- [ ] Source connector registry (RSS, IMAP, GitHub, …)
- [ ] Importance scoring + dedup
- [ ] Schedule entegrasyonu ([V5 schedule](../v5-path/02-scheduled-agent-operations.md))
- [ ] Multi-channel delivery
- [ ] Feedback → personal memory

---

## Başarı kriteri

- [ ] Telegram'a her gün okunabilir, kısa ve aksiyon odaklı brifing gelir

---

## Sonraki

[03-telegram-remote-control.md](./03-telegram-remote-control.md)
