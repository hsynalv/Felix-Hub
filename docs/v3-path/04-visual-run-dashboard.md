# 04 — Visual Run Dashboard

> **Status:** done (2026-06-24)  
> **Öncelik:** P0 (Faz 1)  
> **Bağımlılık:** [01-agent-runtime-workflow.md](./01-agent-runtime-workflow.md), [02-policy-approval-center.md](./02-policy-approval-center.md)

---

## Amaç

Marketing dashboard değil — **operasyon ekranı**: agent run timeline, tool calls, cost/latency/error, approval queue, plugin health, proje aktivitesi. Chat + execution trace aynı bağlamda.

---

## Mevcut UI envanteri

| Sayfa | Durum | V3 rolü |
|-------|-------|---------|
| `ChatPage` | Güçlü | Run trace sidebar / split view |
| `AdminPage` | Onay + jobs | Approval Center'a taşınır |
| `AuditPage` | Archive | Run steps ile birleşik görünüm |
| `ObservabilityPage` | Health/metrics | Platform health panel |
| `UsagePage` | Token/cost | Run cost breakdown |
| `HomePage` | Dashboard | Ops özet'e dönüşür |

**İlgili:** `mcp-server/frontend/src/pages/`, `components/ops/OpsPrimitives.tsx`

---

## Bilgi mimarisi

```
/run-dashboard (yeni ana sayfa veya /ops)
├── Overview strip (health, pending approvals, active runs, cost today)
├── Active runs list
├── Run detail (drawer veya /runs/:id)
│   ├── Timeline (vertical)
│   ├── Step detail (input/output, latency, cost)
│   ├── Approval markers
│   └── Replay / cancel actions
├── Approval queue (embed veya link)
└── Project filter
```

Chat entegrasyonu:

```
/chat?c=...&run=...
  ├── Sol: conversation
  └── Sağ (collapsible): live run trace
```

---

## Timeline bileşeni

| Step tipi | Görsel |
|-----------|--------|
| `llm` | Model adı, token, süre |
| `tool` | Plugin + tool, status icon |
| `approval` | Amber bekleyen / yeşil onay |
| `error` | Kırmızı, expandable stack |

Animasyon: streaming sırasında canlı append (SSE); tamamlanınca soft settle (mevcut chat animasyon prensipleri).

---

## Uygulama fazları

### Faz A — Run list + detail MVP (2 hafta)

- [x] `GET /runs` API client (`runs-api.ts`)
- [x] `RunsPage` — liste + step timeline
- [x] Nav: sidebar'a "Runs" eklendi
- [x] Run detail: cancel aksiyonu
- [x] Run detail: replay aksiyonu
- [x] Nav: HomePage aktif run + onay özeti

### Faz B — Live trace + chat split (1 hafta)

- [x] Chat SSE'den `run_id` + `run_step` events
- [x] Chat yanında canlı timeline (`RunTracePanel`)
- [x] `?run=` query param + Runs'dan sohbete link

### Faz C — Ops overview (1 hafta)

- [x] HomePage: aktif run sayısı + bekleyen onay
- [x] Pending approval sayısı + Admin link
- [x] Bugünkü usage (7 gün token/maliyet kartları)
- [ ] Per-project activity (Pillar 03 — Faz 2)

### Faz D — Gelişmiş analitik (2 hafta)

- [x] Run içi latency özeti (step duration toplamı)
- [x] Error count by run (tool step hataları)
- [ ] Cost breakdown chart (run → tool → model) — Faz 2 usage join
- [x] Export trace JSON (debug)

---

## Tasarım ilkeleri

- **Ops-first:** Yoğun bilgi, koyu tema, monospace trace
- **Mevcut OpsPrimitives** yeniden kullan (`OpsStatCard`, `OpsPanel`)
- **Erişilebilirlik:** Keyboard nav timeline'da
- **Performans:** 500+ step run'da virtualized list

---

## API ihtiyaçları (backend)

| Veri | Kaynak |
|------|--------|
| Runs | Pillar 01 API |
| Steps | `/runs/:id/steps` |
| Live | `/runs/:id/events` SSE |
| Approvals | Pillar 02 |
| Cost | `usage` ledger join `run_id` |
| Health | `/observability/health`, plugin health |

---

## Exit criteria

- [x] Runs sayfası production kullanılabilir
- [x] Chat + trace split çalışır
- [x] Admin onay kuyruğu Runs/Ops'tan erişilir (Admin + `/runs`)
- [x] Audit sayfası run_id filtresi

**Sonraki:** [06-usage-cost-quota.md](./06-usage-cost-quota.md)
