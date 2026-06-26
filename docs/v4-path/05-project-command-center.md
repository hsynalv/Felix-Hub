# 05 — Project Command Center

> **Status:** done  
> **Faz:** V4.5  
> **Bağımlılık:** [04-approval-center-pro.md](./04-approval-center-pro.md) (paralel başlanabilir)

---

## Amaç

Proje bazlı operasyon ekranı oluşturmak.

---

## Kapsam

- Son agent runs.
- Son PR/issue/commit.
- Notion/Obsidian kararları.
- Bağlı entegrasyonlar.
- Aktif riskler.
- Son maliyet.
- "Bugün bu projede ne oldu?" özeti.
- "Bu hedef için gerekli context" önerisi.

---

## Veri kaynakları

```text
agent_runs
project_context_events
GitHub
Notion
Obsidian
RAG
usage_ledger
audit
```

---

## v3.4 köprüsü

- `project_context_for_goal` MCP tool
- `ProjectContextGraph` settings UI
- `workspace_preferences` DB-backed project seçimi

---

## Başarı kriteri

- [x] Bir projeye girince kullanıcı sistemin son durumunu tek ekranda görür

---

## Sonraki

[06-desktop-control-agent.md](./06-desktop-control-agent.md)
