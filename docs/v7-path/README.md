# V7 Path — Personal AI Operating System

> **Ürün yönü:** MCP Hub + Agent Runtime + Desktop Sidecar → kişisel AI işletim sistemi  
> **Değer önerisi:** Kod, iş, haber, mail, alışveriş, araştırma, günlük plan ve bilgisayar kontrolünü tek güvenli agent sisteminde toplamak.

Bu klasör, V7 büyüme adımlarının **tek tek takip edilebilir planlarıdır**. Önkoşul: [V6 path](../v6-path/README.md) (veya V4/V5 çekirdek). Sıra için [EXECUTION-ORDER.md](./EXECUTION-ORDER.md) esas alınır.

**MVP tamamlandı** (2026-06-26): kişisel agent OS iskeleti — Command Center, briefing (hub-native), Telegram, memory, autonomy, life agents, Jarvis UI.  
**Production backlog:** [POST-MVP-BACKLOG.md](./POST-MVP-BACKLOG.md) — mail/haber connector'ları, zamanlanmış execution, Telegram dosya/desktop hardening.

---

## Strateji özeti

```text
V3: Agent execution platform
V4: Premium engineering agent
V5: Managed autonomous operations
V6: Agent ecosystem scale
V7: Personal AI operating system
```

V7'nin amacı, MCP Hub'ı kullanıcının **günlük hayatını ve bilgisayarını güvenli şekilde yöneten** kişisel AI assistant platformuna dönüştürmektir.

---

## Odak alanları

- Daily briefing
- Telegram remote control
- Browser/desktop assistant
- Shopping research
- Life automation agents
- Personal memory
- Permission/autonomy model
- Jarvis-like interface

> **Not:** n8n workflow builder ayrı pillar değildir — çekirdek orchestration altyapısı olarak life automation'da kullanılır.

---

## Plan dosyaları

| # | Dosya | Odak |
|---|-------|------|
| 00 | [00-vision.md](./00-vision.md) | Vizyon, ilkeler, önkoşullar |
| 01 | [01-personal-command-center.md](./01-personal-command-center.md) | Günlük merkez dashboard |
| 02 | [02-daily-briefing-agent.md](./02-daily-briefing-agent.md) | Mail, haber, RSS özet |
| 03 | [03-telegram-remote-control.md](./03-telegram-remote-control.md) | Uzaktan agent yönetimi |
| 04 | [04-browser-desktop-assistant.md](./04-browser-desktop-assistant.md) | Sidecar browser/desktop |
| 05 | [05-shopping-research-assistant.md](./05-shopping-research-assistant.md) | Ürün araştırma, sepete kadar |
| 06 | [06-life-automation-agents.md](./06-life-automation-agents.md) | Mail, takvim, finans agent'ları |
| 07 | [07-personal-memory-profile.md](./07-personal-memory-profile.md) | Explicit kişisel memory |
| 08 | [08-permission-autonomy-model.md](./08-permission-autonomy-model.md) | L0–L5 kişisel autonomy |
| 09 | [09-jarvis-interface.md](./09-jarvis-interface.md) | Çok kanallı premium UI |
| 10 | [10-personal-ops-hardening.md](./10-personal-ops-hardening.md) | Fail-safe, emergency stop |

**Sıra:** [EXECUTION-ORDER.md](./EXECUTION-ORDER.md)  
**Production:** [POST-MVP-BACKLOG.md](./POST-MVP-BACKLOG.md)

Checklist etiketleri: **`[mvp]`** = iskelet tamam; **`[prod]`** = günlük kullanım / production için kalan.

---

## Nasıl kullanılır

1. [EXECUTION-ORDER.md](./EXECUTION-ORDER.md) içinden aktif fazı seç.
2. Pillar maddelerini issue/PR'lara böl.
3. **Başarı kriteri** kutusunu işaretle.
4. `Status:` satırını güncelle.

İlgili dokümanlar: [v4-path](../v4-path/README.md), [v5-path](../v5-path/README.md), [v6-path](../v6-path/README.md).
