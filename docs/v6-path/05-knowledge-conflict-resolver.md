# 05 — Knowledge Conflict Resolver

> **Status:** not_started  
> **Faz:** V6.11  
> **Bağımlılık:** [V4 Project Command Center](../v4-path/05-project-command-center.md), [02-agent-skill-store.md](./02-agent-skill-store.md)

---

## Amaç

Project memory büyüdükçe çıkan çelişkileri tespit edip raporlamak.

---

## Çelişki kaynakları

- Notion'da farklı bilgi
- Obsidian'da eski karar
- README güncel değil
- Kod başka söylüyor
- Agent memory yanlış öğrenmiş

---

## Premium özellik örneği

```text
"Bu projede auth JWT mi API key mi?"
→ sistem kaynakları karşılaştırır, çelişki raporu verir
```

---

## Kapsam

- [ ] Source attribution (hangi kaynak, ne zaman, güven skoru)
- [ ] Conflict detection job (semantic + keyword)
- [ ] Conflict report UI + önerilen çözüm
- [ ] "Accept source A" / pin / deprecate kararı
- [ ] MCP tool: `project_resolve_conflict`
- [ ] Inbox entegrasyonu: conflict alert

---

## Başarı kriteri

- [ ] Bilinen çelişki için kaynak karşılaştırmalı rapor üretilir
- [ ] Kullanıcı kararı project context'e yazılır ve tekrar conflict düşer

---

## Sonraki

[06-agent-trust-score.md](./06-agent-trust-score.md)
