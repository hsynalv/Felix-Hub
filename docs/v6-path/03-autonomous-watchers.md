# 03 — Autonomous Watchers

> **Status:** mvp_done  
> **Faz:** V6.3  
> **Bağımlılık:** [V5 Scheduled Operations](../v5-path/02-scheduled-agent-operations.md), [V4 Runtime v2](../v4-path/02-agent-runtime-v2.md)

---

## Amaç

Event watcher — V5 schedule katmanının olay-tetiklemeli genişlemesi.

---

## Tetikleyici örnekleri

- GitHub check failed
- New issue assigned
- Production error spike
- Notion task moved
- Cost anomaly
- Dependency vulnerability
- Obsidian note tagged `#todo`

---

## Model

```text
watcher → event match → policy check → agent_run (skill/template)
```

- Event source: webhook, poll, file-watcher, sidecar signal
- Debounce + cooldown (spam önleme)
- Budget/quota pre-check (V4 cost guardrails)

---

## Kapsam

- [ ] `watchers` tablosu + CRUD API
- [ ] Event subscription registry (GitHub, Notion, …)
- [ ] Watcher → run spawn pipeline
- [ ] Watcher UI: create, pause, test fire
- [ ] Audit: hangi event hangi run'ı açtı

---

## Başarı kriteri

- [ ] GitHub CI fail olunca tanımlı skill ile otomatik run açılır
- [ ] Quota/policy ihlalinde run açılmaz, Inbox'a düşer

---

## Sonraki

[07-sandbox-simulation-lab.md](./07-sandbox-simulation-lab.md)
