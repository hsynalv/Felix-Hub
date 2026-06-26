# 05 — Shopping Research Assistant

> **Status:** `mvp_done` — Tavily/stub search + cart approval gate  
> **Production:** `pending` — site-specific extract, browser cart → [POST-MVP-BACKLOG](./POST-MVP-BACKLOG.md#6-shopping--gerçek-site-akışı-78-prod)
> **Faz:** V7.8  
> **Bağımlılık:** [04-browser-desktop-assistant.md](./04-browser-desktop-assistant.md), [03-telegram-remote-control.md](./03-telegram-remote-control.md)

---

## Amaç

E-ticaret sitelerinde ürün araştırması, fiyat karşılaştırması ve sepet hazırlığı — **ödeme kullanıcıda**.

---

## Kapsam

- Ürün arama
- Fiyat karşılaştırma
- Satıcı puanı kontrolü
- Yorum özeti
- Alternatif ürün önerisi
- Kargo süresi kontrolü
- Sepete ekleme için onay
- Satın alma öncesi final summary

---

## Akış

```text
1. Kullanıcı ürün ister
2. Agent seçenekleri bulur
3. Fiyat/satıcı/yorum özetler
4. Kullanıcı seçim yapar
5. Agent sepete eklemek için onay ister
6. Ödeme adımı kullanıcıya bırakılır
```

---

## Güvenlik — agent onaysız yapamaz

- ödeme yapamaz
- kart seçemez
- adres değiştiremez
- siparişi tamamlayamaz
- abonelik başlatamaz

---

## Kapsam

### MVP (done)

- [mvp] `shopping-research` life agent preset
- [mvp] `searchProducts` — Tavily (`tavily__tavily_search`) veya stub fallback
- [mvp] Telegram `/shopping`, web `/life` UI
- [mvp] Sepet onay gate (`cart` → `approve`; ödeme kullanıcıda)
- [mvp] Payment policy hook (ops layer)

### Production (pending)

- [prod] Site-specific extract (Hepsiburada, Trendyol, Amazon TR)
- [prod] Structured parse: fiyat, satıcı puanı, yorum özeti, kargo
- [prod] Browser automation: ürün sayfası okuma, sepet öncesi onaylı click
- [prod] Tavily extract + browser hybrid pipeline

---

## Başarı kriteri

- [mvp] Telegram/web'den arama + karşılaştırma özeti + sepet onay akışı (stub/Tavily)
- [prod] Gerçek e-ticaret sitesinde ürün sayfası okuma ve sepete kadar yardım

---

## Sonraki

[06-life-automation-agents.md](./06-life-automation-agents.md)
