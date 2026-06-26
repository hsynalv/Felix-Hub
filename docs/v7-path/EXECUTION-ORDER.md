# V7 Execution Order

> **Son güncelleme:** 2026-06-26  
> **Önkoşul:** [V6 EXECUTION-ORDER](../v6-path/EXECUTION-ORDER.md) **kapatıldı** (`mvp_done`, 2026-06-26)  
> **Kural:** Önce kişisel merkez + brifing → local assistant + güvenlik → günlük hayat agent'ları → olgunlaştırma  
> **Post-MVP:** Günlük hayat + production işleri → [POST-MVP-BACKLOG.md](./POST-MVP-BACKLOG.md)

---

## Durum modeli (2026-06-26)

| Etiket | Anlam |
|--------|--------|
| `mvp_done` | İskelet, API, UI, testler — hub-native veya stub ile demo |
| `production_pending` | Connector, scheduler, site automation, hardening, persistence |

**Tüm Faz 1–4 pillar'ları `mvp_done`.** Gerçek günlük kullanım için [POST-MVP-BACKLOG.md](./POST-MVP-BACKLOG.md) P0–P3.

## Strateji özeti

```mermaid
flowchart TB
  subgraph phase1 [Faz 1 — Temel kişisel katman]
    P01[01 Command Center]
    P02[02 Daily Briefing]
    P03[03 Telegram Control]
    P07[07 Personal Memory]
  end
  subgraph phase2 [Faz 2 — Local assistant]
    P04[04 Browser Desktop]
    P08[08 Permission Autonomy]
    P10[10 Ops Hardening]
  end
  subgraph phase3 [Faz 3 — Günlük hayat]
    P05[05 Shopping Research]
    P06[06 Life Automation]
    P09[09 Jarvis Interface]
  end
  subgraph phase4 [Faz 4 — Olgunlaştırma]
    M1[Feedback loop]
    M2[Voice + overlay]
  end
  phase1 --> phase2 --> phase3 --> phase4
```

---

## Faz 1 — Temel kişisel katman (V7.1 – V7.4)

| Sıra | Pillar | Dosya | MVP | Production |
|------|--------|-------|-----|------------|
| 7.1 | Personal Command Center | [01](./01-personal-command-center.md) | done | scope toggle UI |
| 7.2 | Daily Briefing Agent | [02](./02-daily-briefing-agent.md) | done | IMAP/RSS + schedule |
| 7.3 | Telegram Remote Control | [03](./03-telegram-remote-control.md) | done | file/desktop hardening |
| 7.4 | Personal Memory Profile | [07](./07-personal-memory-profile.md) | done | DB persistence |

## Faz 2 — Local assistant (V7.5 – V7.7)

| Sıra | Pillar | Dosya | MVP | Production |
|------|--------|-------|-----|------------|
| 7.5 | Browser Desktop Assistant | [04](./04-browser-desktop-assistant.md) | done | browser tools + Telegram photo |
| 7.6 | Permission Autonomy Model | [08](./08-permission-autonomy-model.md) | done | full tool family map |
| 7.7 | Personal Ops Hardening | [10](./10-personal-ops-hardening.md) | done | run replay + redaction e2e |

## Faz 3 — Günlük hayat agent'ları (V7.8 – V7.10)

| Sıra | Pillar | Dosya | MVP | Production |
|------|--------|-------|-----|------------|
| 7.8 | Shopping Research Assistant | [05](./05-shopping-research-assistant.md) | done | site-specific + browser cart |
| 7.9 | Life Automation Agents | [06](./06-life-automation-agents.md) | done | executor + scheduler |
| 7.10 | Jarvis Interface | [09](./09-jarvis-interface.md) | done | overlay depth, voice polish |

## Faz 4 — Olgunlaştırma (V7.11+)

| Madde | Açıklama | Durum |
|-------|----------|-------|
| Daily feedback loop | Brifing/haber "gösterme" feedback'i | mvp_done |
| Memory correction UI | why_do_you_know_this, edit flow | mvp_done |
| Voice interface | Speech in/out (Bugün voice bar + Chat) | mvp_done |
| Desktop overlay | "Şu an ne yapıyor?" overlay | mvp_done |
| Mobile approval polish | Onay UX mobil | mvp_done |

---

## Milestone etiketleri

| Etiket | İçerik |
|--------|--------|
| `v7.0-alpha` | Command Center + Daily Briefing + Telegram MVP (7.1–7.3: run/onay, event push) |
| `v7.0-beta` | Desktop assistant + autonomy + hardening (7.5–7.7) |
| `v7.1` | ~~Telegram tam kapsam~~ → **`v7.1-prod`**: connector + life executor + sidecar hardening |
| `v7.2` | Faz 4 MVP (voice, overlay, feedback) — ✅ |
| `v7.2-prod` | Persistence, autonomy depth, tool schema CI |

---

## V6 → V7 köprüsü

| V6 | V7'de kişiselleşir |
|----|---------------------|
| Personal Operating Model | Personal Memory Profile |
| Agent Inbox | Command Center + Telegram |
| Desktop Control | Browser Desktop Assistant → **Telegram uzaktan yüzeyi** (`/file`, `/desktop`) |
| Managed autonomy (V5) | Permission Autonomy Model (personal scope) |
| Agent App Store | Life Automation agent profilleri |
| n8n plugin | Life automation orchestration (altyapı, pillar değil) |

> **Ürün notu (2026-06-26):** Telegram MVP tamam (`/brief`, run/onay, `/file` `/desktop` text preview). Production: attachment, photo, inline desktop onay — [03](./03-telegram-remote-control.md) + [POST-MVP-BACKLOG](./POST-MVP-BACKLOG.md).

---

## Paralel çalışma kuralları

| Yapılabilir paralel | Yapılmamalı paralel |
|---------------------|---------------------|
| 01 Command Center UI + 02 Briefing backend | 04 desktop tools + 10 hardening aynı sprint (policy çakışması) |
| 03 Telegram + 09 Jarvis kanalları | 05 shopping + payment policy refactor |
| 07 Memory + 08 Autonomy | Desktop action rate limit değişirken shopping flow test |

---

## İzleme

Her pillar dosyasında:

```markdown
Status: mvp_done | production_pending
MVP checklist: [mvp] …
Production checklist: [prod] …
Last reviewed: YYYY-MM-DD
```
