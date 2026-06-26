# 06 — Desktop Control Agent MVP

> **Status:** done (MVP: observe + assisted click/type)  
> **Faz:** V4.6  
> **Bağımlılık:** [04-approval-center-pro.md](./04-approval-center-pro.md), sidecar altyapısı (V3 Faz 4)

---

## Amaç

Kullanıcının ekranını güvenli, local-first şekilde okuyabilen ve sınırlı kontrol edebilen agent.

---

## Fazlar

| Faz | Mod | Açıklama |
|-----|-----|----------|
| 1 | Observe-only | screenshot + OCR + active window |
| 2 | Suggest-only | "şuraya tıkla" önerisi |
| 3 | Assisted action | click/type için onay |
| 4 | Scoped automation | sadece allowlisted app/domain |
| 5 | Full control | sadece özel güvenli mod |

---

## Sidecar tool fikirleri

```text
desktop_screenshot
desktop_ocr
desktop_active_window
desktop_find_text
desktop_click
desktop_type
desktop_hotkey
desktop_scroll
desktop_app_focus
browser_open
browser_click_selector
browser_type_selector
```

---

## Güvenlik

- Screen Recording + Accessibility permission localde.
- Server doğrudan ekran görmez; sidecar aracılığıyla.
- Emergency stop.
- Allowlisted apps/domains.
- Password field detection.
- Her action audit + run step.

---

## Başarı kriteri

- [x] Agent ekranı okuyabilir
- [x] Onaylı şekilde basit UI aksiyonu yapabilir
- [x] Tüm aksiyonlar `/runs` timeline'da görünür

---

## Stratejik not

Desktop Control, **stratejik üçlünün** bir parçası (Designer + Desktop + Eval).

---

## Sonraki

[07-self-healing-dev-agent.md](./07-self-healing-dev-agent.md)
