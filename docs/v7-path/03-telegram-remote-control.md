# 03 — Telegram Remote Control

> **Status:** partial (notifications plugin, telegram webhook)  
> **Faz:** V7.3  
> **Bağımlılık:** [02-daily-briefing-agent.md](./02-daily-briefing-agent.md), [08-permission-autonomy-model.md](./08-permission-autonomy-model.md)

---

## Amaç

Kullanıcı evde değilken agent sistemini **Telegram üzerinden** yönetebilsin.

---

## Komutlar

```text
/brief
/news ai
/email important
/runs
/approve <id>
/deny <id>
/stop <run_id>
/project <name> status
/desktop status
/shopping search <query>
/remind <text>
```

---

## Güvenlik

- Allowed chat ID zorunlu
- Admin komutları için ikinci onay
- Riskli aksiyonlarda approval
- Para harcama aksiyonlarında manuel final confirmation
- Shell/desktop/browser aksiyonları için screenshot preview
- Emergency stop

---

## Telegram event tipleri

```text
brief_ready
approval_required
run_completed
run_failed
desktop_action_preview
shopping_result_ready
incident_alert
```

---

## Kapsam

- [ ] Telegram command router (mevcut webhook genişletme)
- [ ] Run/approval API köprüsü
- [ ] Inline keyboard: approve/deny
- [ ] Event push formatter (her event tipi)
- [ ] Admin command ikinci onay
- [ ] Emergency `/stop` global pause

---

## Başarı kriteri

- [ ] Kullanıcı Telegram'dan run başlatabilir, durum sorabilir, onay verebilir ve sistemi durdurabilir

---

## Sonraki

[07-personal-memory-profile.md](./07-personal-memory-profile.md)
