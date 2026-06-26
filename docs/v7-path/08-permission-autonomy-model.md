# 08 — Permission Autonomy Model

> **Status:** mvp_done  
> **Faz:** V7.6  
> **Bağımlılık:** [V4 Approval Center Pro](../v4-path/04-approval-center-pro.md)

---

## Amaç

Kişisel agent sisteminde izin ve otonomi seviyelerini standartlaştırmak — engineering + personal scope.

---

## Seviyeler

```text
L0 observe_only
L1 suggest_only
L2 draft_only
L3 act_with_approval
L4 scoped_autonomous
L5 low_risk_autonomous
```

---

## Policy örnekleri

```text
Mail okuyabilir ama silemez.
Alışverişte ödeme yapamaz.
Desktop click için approval gerekir.
Telegram'dan gelen shell komutları admin approval ister.
Haber brifingi otomatik çalışabilir.
Production project'te sadece read-only analiz yapabilir.
```

---

## Risk kategorileri

```text
read
personal_data
external_send
money
desktop_control
file_write
destructive
production
credential
```

---

## Kapsam

- [x] Personal autonomy preset UI (Bugün sayfası)
- [x] V5 L0–L5 + personal risk mapping
- [x] Risk category → required level mapping
- [x] Telegram / desktop policy presets (cautious, balanced, helper)
- [x] Runtime enforcement personal scope (desktop tools hook)

---

## Başarı kriteri

- [x] Her agent action, risk kategorisi ve autonomy level ile değerlendirilir

---

## Sonraki

[10-personal-ops-hardening.md](./10-personal-ops-hardening.md)
