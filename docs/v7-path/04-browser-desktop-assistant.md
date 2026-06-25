# 04 — Browser Desktop Assistant

> **Status:** partial ([V4 Desktop Control](../v4-path/06-desktop-control-agent.md), sidecar)  
> **Faz:** V7.5  
> **Bağımlılık:** [08-permission-autonomy-model.md](./08-permission-autonomy-model.md), [10-personal-ops-hardening.md](./10-personal-ops-hardening.md)

---

## Amaç

Local sidecar üzerinden browser ve desktop'ta **güvenli yardımcı agent** — kişisel kullanım odaklı.

---

## Modlar

```text
observe_only
suggest_only
assist_with_approval
scoped_automation
```

---

## Tool yüzeyi

```text
desktop_screenshot
desktop_ocr
desktop_active_window
desktop_find_text
desktop_app_focus
desktop_click
desktop_type
desktop_hotkey
desktop_scroll
browser_open
browser_find
browser_click_selector
browser_type_selector
browser_extract_page
```

---

## Güvenlik

- Screen Recording permission localde
- Accessibility permission localde
- Allowlisted apps
- Allowlisted domains
- Password field detection
- Secret redaction
- Max action count
- Emergency stop
- Her aksiyon run step + audit

---

## Onaysız yasak alanlar

- ödeme
- mail silme
- production değişikliği
- terminal destructive command
- dosya silme
- şifre alanına yazma
- banka/ödeme ekranı

---

## Kapsam

- [ ] Sidecar desktop/browser tool implementasyonu (V4'ten genişletme)
- [ ] Personal allowlist UI (apps, domains)
- [ ] Password/payment screen detector
- [ ] Screenshot preview → Telegram approval
- [ ] Action rate limit per run

---

## Başarı kriteri

- [ ] Agent ekranı okuyabilir, sayfa analiz edebilir, onaylı şekilde basit browser/desktop aksiyonu yapabilir

---

## Sonraki

[08-permission-autonomy-model.md](./08-permission-autonomy-model.md)
