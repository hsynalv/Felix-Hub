# 08 — Permission Autonomy Model

> **Status:** `mvp_done` — 3 preset, desktop hook, ~15 tool map  
> **Production:** `pending` — full tool family registry → [POST-MVP-BACKLOG](./POST-MVP-BACKLOG.md#4-personal-autonomy-risk-map-76-prod)
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

### MVP (done)

- [mvp] 3 preset: cautious / balanced / helper
- [mvp] `TOOL_RISK_MAP` (~15 tool; desktop + shopping + memory)
- [mvp] `evaluatePersonalAutonomy` + desktop hook
- [mvp] UI: Bugün sayfası autonomy kartı

### Production (pending)

- [prod] Browser tool ailesi (click, type, navigate, upload)
- [prod] Email/send ailesi
- [prod] File upload / write ailesi
- [prod] n8n workflow write
- [prod] Per-tool override + audit trail
- [prod] Telegram channel-specific policy matrix

---

## Başarı kriteri

- [mvp] Desktop + shopping + memory aksiyonları risk seviyesiyle değerlendirilir
- [prod] Tüm write/destructive tool aileleri sınıflandırılmış ve enforce edilir

---

## Sonraki

[10-personal-ops-hardening.md](./10-personal-ops-hardening.md)
