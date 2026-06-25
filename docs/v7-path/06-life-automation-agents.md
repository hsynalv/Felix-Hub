# 06 — Life Automation Agents

> **Status:** not_started  
> **Faz:** V7.9  
> **Bağımlılık:** [02-daily-briefing-agent.md](./02-daily-briefing-agent.md), [07-personal-memory-profile.md](./07-personal-memory-profile.md)

---

## Amaç

Kod dışı **günlük hayat agent'larını** standartlaştırmak.

---

## Agent tipleri

```text
Mail Triage Agent
News Briefing Agent
Calendar Prep Agent
Shopping Research Agent
Reminder Agent
Research Agent
Reading List Agent
Finance Summary Agent
Travel Planning Agent
Obsidian Organizer Agent
```

---

## Ortak model

Her life agent:

```text
name
goal
sources
allowed_tools
schedule
approval_policy
output_channels
memory_scope
cost_limit
```

---

## Örnekler

```text
Toplantıdan 30 dk önce ilgili mailleri ve notları özetle.
Haftalık harcamaları kategorilere ayır.
Okumam gereken AI makalelerini bul ve Obsidian'a kaydet.
```

---

## Altyapı notu

**n8n** ayrı pillar değil — karmaşık life automation akışları için mevcut n8n plugin orchestration katmanı olarak kullanılır. Life agent profili → n8n workflow veya native runbook'a derlenebilir.

---

## Kapsam

- [ ] Life agent profile schema + CRUD
- [ ] Preset katalog (mail triage, calendar prep, …)
- [ ] Schedule + watcher entegrasyonu
- [ ] Output channel binding
- [ ] Life agent UI: oluştur, test, geçmiş

---

## Başarı kriteri

- [ ] Kullanıcı günlük tekrar eden işleri agent profilleri olarak tanımlayabilir

---

## Sonraki

[09-jarvis-interface.md](./09-jarvis-interface.md)
