# 12 — Agent Observability Pro

> **Status:** mvp_done  
> **Faz:** V6.7  
> **Bağımlılık:** [06-agent-trust-score.md](./06-agent-trust-score.md), [V4 Observability](../v3-path/04-visual-run-dashboard.md)

---

## Amaç

Observability sadece sistem değil — **agent davranışı** için.

---

## Metrikler ve görünümler

- Tool-call graph
- Failure hotspots
- Prompt drift
- Model latency
- Approval bottlenecks
- Cost hotspots
- Workflow reliability trend

---

## Kapsam

- [ ] Agent-centric metrics aggregation
- [ ] Observability Pro dashboard sayfası
- [ ] Drill-down: workflow → step → tool → model
- [ ] Alert rules (failure rate, cost spike, approval queue depth)
- [ ] Export / Grafana uyumlu endpoint (opsiyonel)

---

## Başarı kriteri

- [ ] Son 7 gün failure hotspot'ları dashboard'da görünür
- [ ] Approval bottleneck hangi tool/step'te olduğu tespit edilebilir

---

## V6 tamamlanma

Tüm pillar'lar tamamlandığında platform:

> Agent ekosistemi ölçeklenir, güvenilirleşir ve kişiselleşir — ekip ve kurum ölçeğinde yönetilebilir ürün.

[00-vision.md](./00-vision.md)
