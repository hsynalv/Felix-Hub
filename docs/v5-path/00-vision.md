# 00 — V5 Vizyon: Managed Autonomous Operations

> **Status:** done    
> **Önkoşul:** [V4 path](../v4-path/EXECUTION-ORDER.md) tamamlandı  
> **Bağımlılık:** —

---

## Tek cümle

**mcp-hub V5**, güçlü agent kabiliyetlerini **sürekli, kontrollü, operasyonel ve üretim süreçlerine bağlı** günlük mühendislik operasyonuna çevirir.

---

## Üç soru

| Aşama | Soru |
|-------|------|
| V4 | Agent güçlü şekilde iş yapabiliyor mu? |
| **V5** | Bu agent işleri sürekli, güvenli ve operasyonel olarak yönetilebiliyor mu? |
| V6 | Agent ekosistemi ekip/kurum ölçeğinde nasıl büyür? |

---

## Evrim çizgisi

```text
V4: Premium agent kabiliyetleri
    Run designer, desktop control, self-healing, eval studio

V5: Managed autonomous operations
    Runbook, schedule, release, incident, SLA, environment promotion

V6: Agent ecosystem scale
    Multi-agent, skill store, watchers, inbox, app store, compliance
```

V4 agent'a premium kabiliyet verir. V5 bu işleri **runbook, zamanlama, SLA ve ortam kontrolü** ile operasyon sistemine bağlar. V6 aynı omurga üzerinde ekosistemi ölçeklendirir.

---

## Ürün ilkeleri (V5)

1. **Operations over one-offs** — Tek seferlik run değil; versiyonlu runbook ve tekrarlayan operasyon.
2. **Autonomy is explicit** — L0–L5 seviyeleri; her ortam ve proje için tanımlı.
3. **Fail with escalation** — Timeout, maliyet, tekrarlayan hata → insan veya ticket.
4. **Promotion gates** — Dev → staging → prod; production'da sıkı policy.
5. **Reports humans read** — Dashboard verisi → günlük/haftalık brief.

---

## V4 → V5 köprüsü

| V4 | V5'te operasyonel hale gelir |
|----|------------------------------|
| Run Designer + templates | Runbook automation (version, SLA, rollback) |
| Self-Healing Dev Agent | Release Manager + Maintenance Agent |
| Approval Center Pro | Managed autonomy levels + escalation |
| Project Command Center | Reports & briefings |
| Cost/Quota guardrails | SLA + schedule max cost |
| `x-project-id` / `x-env` | Environment promotion & change control |

---

## Sonraki adım

[EXECUTION-ORDER.md](./EXECUTION-ORDER.md) → Faz V5.1: [01-runbook-automation.md](./01-runbook-automation.md)
