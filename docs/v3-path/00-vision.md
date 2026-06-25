# 00 — Vizyon ve Ürün İlkeleri

> **Status:** reference (implementasyon değil)  
> **Last reviewed:** 2026-06-25  
> **Bağımlılık:** —

---

## Tek cümle

**mcp-hub**, AI ajanlarının gerçek projelerde **kontrollü, izlenebilir ve tekrar üretilebilir** şekilde iş yapmasını sağlayan merkezi **agent execution platformu**dur.

---

## Neden V3?

| V2 gerçeği | V3 hedefi |
|------------|-----------|
| 35 plugin, tool hub | Az sayıda **güvenilir capability**, çok sayıda **run** |
| Chat + ayrı audit/logs | Chat = run yüzeyi; audit = run trace parçası |
| Policy kod içinde | Policy **ürün** — kural, onay, dry-run |
| Parçalı memory (brain, RAG, Notion) | **Project workspace** — tek context graph |
| Admin sayfaları dağınık | **Operasyon dashboard** — timeline, cost, health |

Değer ölçütü: *"Kaç plugin var?"* değil, *"Bu agent run'ı güvenle tekrar oynatabilir miyim ve neye mal oldu?"*

---

## Ürün ilkeleri

1. **Fail-closed** — Belirsiz izin = red; marketplace ve destructive tool'lar varsayılan kapalı.
2. **Run as first-class citizen** — Her anlamlı agent oturumu `run_id` ile kimliklenir.
3. **Human-in-the-loop by design** — Onay checkpoint'leri veri modelinin parçası, UI sonradan eklenen değil.
4. **Observable by default** — Tool call, token, latency, error, approval her run'da yapılandırılmış.
5. **Project-scoped context** — Agent cevabı mümkün olduğunca proje/workspace bağlamında.
6. **No silent dual stacks** — Registry, jobs, audit için tek authoritative kaynak (Pillar 10).

---

## Kullanıcı personaları

| Persona | İhtiyaç | Ana yüzey |
|---------|---------|-----------|
| **Developer** | Chat'te agent çalıştır, tool onayla | Chat + run trace |
| **Tech lead** | Policy, quota, maliyet | Policy Center + Usage |
| **Platform admin** | Plugin, secret, health | Marketplace + Settings |
| **SRE / ops** | Incident, replay, audit | Run Dashboard + Observability |

---

## Başarı metrikleri (V3)

| Metrik | Hedef (6 ay) |
|--------|----------------|
| Run trace coverage | %100 tool call'lar run'a bağlı |
| Mean time to approve | < 30 sn (UI üzerinden) |
| Run replay success | Kritik senaryoların %80'i replay edilebilir |
| Cost visibility | Her run'da tahmini USD |
| Regression | En az 5 golden trace CI'da |
| Plugin onboarding | Yeni plugin < 15 dk (wizard ile) |

---

## Kapsam dışı (bilinçli)

- Genel amaçlı "her SaaS için 100 connector" yarışı
- Consumer chatbot (B2C)
- Model training / fine-tuning platformu
- Tam otomatik production deploy (insan onayı olmadan)

---

## Konumlandırma

```
Cursor / Claude Desktop  →  tek kullanıcı, IDE odaklı
mcp-hub V3               →  ekip, proje, policy, audit, cost, replay
n8n / Temporal           →  deterministik workflow (biz: LLM + tool agent)
```

**Farklılaşma:** Güvenli agent execution + engineering project memory.

---

## Sonraki adım

[EXECUTION-ORDER.md](./EXECUTION-ORDER.md) → Faz 0: [10-production-hardening.md](./10-production-hardening.md)
