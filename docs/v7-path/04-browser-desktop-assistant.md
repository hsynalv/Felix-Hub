# 04 — Browser Desktop Assistant

> **Status:** `mvp_done` — sidecar tools + allowlist API + Telegram text preview  
> **Production:** `pending` — photo push, action approve flow, redaction tests → [POST-MVP-BACKLOG](./POST-MVP-BACKLOG.md#3-telegram-file--desktop-production-hardening-73--75-prod)
> **Faz:** V7.5  
> **Bağımlılık:** [08-permission-autonomy-model.md](./08-permission-autonomy-model.md), [10-personal-ops-hardening.md](./10-personal-ops-hardening.md)

---

## Amaç

Local sidecar üzerinden browser ve desktop'ta **güvenli yardımcı agent** — kişisel kullanım odaklı.

**Uzaktan yüzey:** Tam kapsamda bu yetenekler [03 Telegram Remote Control](./03-telegram-remote-control.md) üzerinden de kullanılabilir olacak (`/desktop screenshot`, onaylı click/type). Evde değilken Telegram birincil kumanda; sidecar ev bilgisayarında çalışır.

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

### MVP (done)

- [mvp] Sidecar desktop/browser tools (V4 genişletme)
- [mvp] Personal allowlist API (apps, domains)
- [mvp] Password/payment detector (desktop-guard + ops)
- [mvp] Screenshot/window preview API + Telegram `/desktop` (text)
- [mvp] Action rate limit per run/day

### Production (pending)

- [prod] Screenshot → Telegram `sendPhoto` + redaction integration tests
- [prod] Desktop action: preview → inline onay → click/type
- [prod] Browser assist scoped automation (domain allowlist enforce)
- [prod] Sidecar offline detection + hub error surface

---

## Başarı kriteri

- [mvp] Agent ekranı okuyabilir; Telegram'dan text preview alınabilir
- [prod] Onaylı desktop/browser aksiyonu uzaktan tamamlanır; hassas ekran redakte edilir

---

## Sonraki

[08-permission-autonomy-model.md](./08-permission-autonomy-model.md)
