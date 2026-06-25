# 02 — Agent Skill Store

> **Status:** not_started  
> **Faz:** V6.2  
> **Bağımlılık:** [01-multi-agent-collaboration.md](./01-multi-agent-collaboration.md), [V4 Run Designer](../v4-path/03-agent-run-designer.md)

---

## Amaç

Plugin marketplace'ten ayrı, yeniden kullanılabilir **agent skill** katmanı.

---

## Skill tanımı

```text
Skill = prompt + allowed tools + eval + policy + examples
```

Workflow template'ten daha zeki ve modüler; multi-agent rollere atanabilir.

---

## Örnek skill'ler

- React refactor skill
- MSSQL migration skill
- Notion project setup skill
- Incident triage skill
- CI failure repair skill

---

## Kapsam

- [ ] Skill manifest schema (version, author, tags)
- [ ] Skill install / pin / disable
- [ ] Skill → workflow template derleme
- [ ] Skill marketplace UI (plugin marketplace'ten ayrı sekme)
- [ ] Skill eval bundle (Eval Studio entegrasyonu)
- [ ] Skill policy overlay (allowed tools, risk class)

---

## Başarı kriteri

- [ ] Kullanıcı "CI failure repair skill" kurup multi-agent run'a atayabilir
- [ ] Skill güncellenince eval regression uyarısı verilir

---

## Sonraki

[03-autonomous-watchers.md](./03-autonomous-watchers.md)
