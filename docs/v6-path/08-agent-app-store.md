# 08 — Agent App Store

> **Status:** not_started  
> **Faz:** V6.8  
> **Bağımlılık:** [02-agent-skill-store.md](./02-agent-skill-store.md), [06-agent-trust-score.md](./06-agent-trust-score.md)

---

## Amaç

Plugin marketplace değil — hazır **agent ürünleri** mağazası.

---

## Örnek agent'lar

- PR Reviewer
- Release Notes Writer
- Bug Fixer
- Meeting Prep Agent
- Obsidian Organizer
- Desktop Assistant
- Cost Optimizer
- Security Auditor

---

## Agent paketi

```text
description + required integrations + policies + eval score + cost estimate
```

---

## Kapsam

- [ ] Agent product manifest (skill bundle + multi-agent template + watcher presets)
- [ ] Install wizard: entegrasyon + policy onayı
- [ ] Trust score + eval badge zorunlu alan
- [ ] Versioning + changelog
- [ ] Uninstall / rollback

---

## Başarı kriteri

- [ ] "PR Reviewer" tek tıkla kurulup GitHub bağlantısıyla çalışır
- [ ] Mağazada maliyet tahmini ve trust skoru görünür

---

## Sonraki

[09-natural-language-admin.md](./09-natural-language-admin.md)
