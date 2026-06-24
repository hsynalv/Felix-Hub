# 04 — Visual Run Dashboard

> **Status:** not_started  
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

- [ ] `GET /runs` API client
- [ ] `RunDashboardPage` veya `HomePage` refactor
- [ ] Run kartları: status, goal, süre, maliyet tahmini
- [ ] Run detail: step listesi (read-only)
- [ ] Nav: sidebar'a "Runs" ekle

**Exit:** Tamamlanmış bir run'ın tüm tool adımları UI'da.

### Faz B — Live trace + chat split (1 hafta)

- [ ] Chat SSE'den `run_id` + step events
- [ ] Chat yanında canlı timeline
- [ ] Focus run from chat message

**Exit:** Chat sırasında tool call anlık timeline'da görünür.

### Faz C — Ops overview (1 hafta)

- [ ] Üst şerit: plugin health özeti (`plugin-health.js`)
- [ ] Pending approval sayısı + link
- [ ] Bugünkü usage (`usage-api`)
- [ ] Per-project activity (Pillar 03 hazır olunca)

### Faz D — Gelişmiş analitik (2 hafta)

- [ ] Latency histogram (run içi)
- [ ] Error rate by plugin
- [ ] Cost breakdown chart (run → tool → model)
- [ ] Export trace JSON (debug)

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

- [ ] Runs sayfası production kullanılabilir
- [ ] Chat + trace split çalışır
- [ ] Admin onay kuyruğu Runs/Ops'tan erişilir
- [ ] Audit sayfası run filtreli veya Runs'a yönlendirilir

**Sonraki:** [06-usage-cost-quota.md](./06-usage-cost-quota.md)
