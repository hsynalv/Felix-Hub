# 05 — Shopping Research Assistant

> **Status:** not_started  
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

## Kapsam (implementation)

- [ ] Shopping research life agent profili
- [ ] Browser extract + compare workflow
- [ ] Telegram: `/shopping search <query>` + sonuç kartları
- [ ] Sepet onay gate (L3 minimum)
- [ ] Payment screen hard block

---

## Başarı kriteri

- [ ] Kullanıcı Telegram'dan ürün araştırması yaptırabilir; agent en iyi seçenekleri getirir ve sepet aşamasına kadar yardımcı olur

---

## Sonraki

[06-life-automation-agents.md](./06-life-automation-agents.md)
