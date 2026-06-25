# 09 — Natural Language Admin

> **Status:** not_started  
> **Faz:** V6.10  
> **Bağımlılık:** [V4 Team packs](../v4-path/10-team-marketplace-packs.md), [08-agent-app-store.md](./08-agent-app-store.md)

---

## Amaç

Platformun kendisini doğal dille yönetmek — Settings UI'ın agent tabanlı üst katmanı.

---

## Örnek komutlar

- "GitHub plugin'i bu proje için aç"
- "Production'da shell write kapat"
- "Bu agent'a aylık $10 limit koy"
- "Notion token'ı rotate et"
- "Desktop control sadece Cursor ve Chrome'da çalışsın"

---

## Kapsam

- [ ] NL admin intent parser → settings/policy API mapping
- [ ] Confirmation + diff preview (değişiklik özeti)
- [ ] Audit: her NL komut kayıt altında
- [ ] Chat veya dedicated Admin Agent UI
- [ ] Desteklenen intent kataloğu + genişletme API

---

## Başarı kriteri

- [ ] Örnek komutlar onay sonrası doğru config/policy değişikliği yapar
- [ ] Desteklenmeyen intent net hata + öneri döner

---

## Sonraki

[10-personal-operating-model.md](./10-personal-operating-model.md)
