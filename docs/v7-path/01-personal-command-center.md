# 01 — Personal Command Center

> **Status:** mvp_done  
> **Faz:** V7.1  
> **Son güncelleme:** 2026-06-26  
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

- [x] Personal Command Center sayfası (Home → `/` Today, mühendislik `/system`)
- [x] Widget aggregation API (`GET /personal/command-center`)
- [x] "Suggested actions" engine (açık approval, stale run, briefing highlight)
- [ ] Proje + kişisel scope toggle (API hazır; UI toggle V7.1+)
- [x] Mobile-responsive layout

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
