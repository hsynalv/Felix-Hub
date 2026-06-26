# 00 — V7 Vizyon: Personal AI Operating System

> **Status:** in_progress (Faz 1–2 mvp_done; Faz 3 bekliyor)  
> **Önkoşul:** [V6 path](../v6-path/EXECUTION-ORDER.md) **kapatıldı** (`mvp_done`, 2026-06-26)  
> **Bağımlılık:** —

---

## Tek cümle

**mcp-hub V7**, MCP Hub + Agent Runtime + Desktop Sidecar'ı **kişisel AI işletim sistemi**ne dönüştürür — kod, iş, haber, mail, alışveriş, araştırma, günlük plan ve bilgisayar kontrolü tek güvenli agent sisteminde.

---

## V7'nin sorusu

```text
Agent sadece proje/kod işlerinde değil, günlük hayatımda ve bilgisayarımda güvenli şekilde bana nasıl yardımcı olur?
```

---

## Evrim çizgisi

| Aşama | Odak |
|-------|------|
| V3 | Agent execution platform |
| V4 | Premium engineering agent |
| V5 | Managed autonomous operations |
| V6 | Agent ecosystem scale |
| **V7** | Personal AI operating system |

---

## Temel ilke

```text
Agent her şeyi yapabilir, ama her şeyi onaysız yapmamalı.
```

---

## Sistem yetenekleri

- Telegram'dan yönetilebilir
- Bilgisayarı local sidecar ile gözlemleyebilir
- Onaylı şekilde browser/desktop aksiyonu alabilir
- Mail, haber, takvim, alışveriş, araştırma ve projeleri takip eder
- Günlük brifing üretir
- Kişisel tercihleri hatırlar (explicit memory)
- Riskli her aksiyonu policy + approval ile sınırlar

---

## Önkoşullar (kod / önceki path'ler)

| Gereksinim | Kaynak |
|------------|--------|
| Agent Runtime | V3 |
| Desktop Control Agent | V4 |
| Approval Center Pro | V4 |
| Project Command Center | V4 |
| Managed Autonomy Policies | V5 |
| Telegram integration | notifications plugin |
| Sidecar pairing | V4 local sidecar |
| Usage/cost guardrails | V4/V5 |
| n8n workflows | **Çekirdek altyapı** — V7 pillar değil; life automation orchestration için kullanılır |

---

## Ürün ilkeleri (V7)

1. **Personal first** — Engineering dashboard değil; günlük merkez ekran.
2. **Remote by default** — Telegram ile uzaktan yönetim birincil kanal. Tam kapsam hedefi: evde değilken bile **kendi bilgisayarından dosya alma**, ekran görme ve onaylı desktop/browser işlemleri — V4 sidecar/desktop agent üzerinden ([03-telegram-remote-control.md](./03-telegram-remote-control.md) ürün notu).
3. **Payment is sacred** — Ödeme, kart, adres değişikliği her zaman insan onayında.
4. **Memory is explicit** — remember / forget / pin / edit; gizli profil yok.
5. **Fail-safe over retry** — Belirsiz UI hedefi → tıklama yok; desktop fail → kullanıcıya sor.

---

## Sonraki adım

[EXECUTION-ORDER.md](./EXECUTION-ORDER.md) → Faz V7.1: [01-personal-command-center.md](./01-personal-command-center.md)
