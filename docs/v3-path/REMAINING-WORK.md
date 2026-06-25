# V3 — Kalan işler (v3.6 sonrası)

> **Son güncelleme:** 2026-06-25  
> Senkron: [EXECUTION-ORDER.md](./EXECUTION-ORDER.md) Faz 6

## Tamamlandı (v3.6)

- [x] Dokümantasyon senkronizasyonu (pillar Status + Mevcut durum)
- [x] Checkpoint resume — `current_step` persist + resume from checkpoint `stepIndex + 1`
- [x] `ProjectSwitcher` — Chat + Runs header, workspace invalidation
- [x] Notion indexer — `fetchNotionActivity` + sync kaynağı
- [x] `GET /projects/:name/ask` + `GET /projects/:name/impact`
- [x] `assertRunQuota` — run create / template / job
- [x] Run detail step maliyet kırılımı (API + Runs UI)
- [x] `settings_audit` migration + audit listesi UI
- [x] 4 golden trace fixtures + plugin meta snapshot test
- [x] Marketplace `dangerousCombinations` enable dialog
- [x] Sidecar `sidecar_devices` persistence
- [x] `/approvals` nav → Onay Merkezi

## Bilinçli erteleme (v3.7 / V4)

- [ ] Replay with full re-execution (şu an dry clone)
- [ ] Formal `RunStatus` transition guards (engine + UI)
- [ ] RAG project-scoped collection re-index
- [ ] Per-project secret override
- [ ] Sidecar mTLS, browser automation, installer
- [ ] Cost waterfall chart, provider comparison, CSV export
- [ ] Budget Telegram/email alerts
- [ ] Nightly agent benchmark suite (`eval:nightly` schedule)
- [ ] ADR auto-suggest, full graph visualization (Faz C+)

Detay: [v4-path/README.md](../v4-path/README.md)
