# 01 — Personal Command Center

> **Status:** not_started  
> **Faz:** V7.1  
> **Bağımlılık:** [V4 Project Command Center](../v4-path/05-project-command-center.md), [V6 Agent Inbox](../v6-path/04-agent-inbox.md)

---

## Amaç

Kullanıcının **günlük merkezi ekranını** oluşturmak — engineering dashboard değil, kişisel operasyon yüzeyi.

---

## Dashboard içeriği

- Günlük özet
- Önemli mailler
- Haber özetleri
- Telegram komut geçmişi
- Açık agent run'ları
- Bekleyen approvals
- Proje durumları
- Bugünkü toplantılar
- Hatırlatmalar
- Maliyet / usage
- Önerilen aksiyonlar

---

## UI bölümleri

```text
Today
Important Mail
News Brief
Active Runs
Approvals
Projects
Personal Tasks
Suggested Actions
```

---

## Kapsam

- [ ] Personal Command Center sayfası (Home veya dedicated route)
- [ ] Widget aggregation API (briefing, mail, runs, approvals)
- [ ] "Suggested actions" engine (açık approval, stale run, briefing highlight)
- [ ] Proje + kişisel scope toggle
- [ ] Mobile-responsive layout

---

## Başarı kriteri

Kullanıcı sabah ekranı açtığında şu soruların cevabını tek yerde görür:

```text
Bugün ne önemli?
Hangi işler bekliyor?
Agent benden ne istiyor?
Projelerimde ne olmuş?
```

---

## Sonraki

[02-daily-briefing-agent.md](./02-daily-briefing-agent.md)
