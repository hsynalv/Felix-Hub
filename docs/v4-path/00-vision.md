# 00 — V4 Vizyon: Premium AI Engineering Agent Platform

> **Status:** not_started  
> **Önkoşul:** [V3 path](../v3-path/EXECUTION-ORDER.md) Faz 0–5 tamamlandı (v3.4)  
> **Bağımlılık:** —

---

## Tek cümle

**mcp-hub V4**, mevcut MCP Hub + agent runtime + local sidecar çizgisini birleştirerek **güvenli, izlenebilir, test edilebilir ve yerel bilgisayarda iş yapabilen** bir AI engineering agent platformuna dönüşür.

---

## Neden V4?

| V3.4 gerçeği | V4 hedefi |
|--------------|------------|
| Run motoru v2 temeli var | Tam workflow motoru + designer |
| Approval chat/admin parçalı | **Approval Center Pro** — risk skoru, diff, policy önerisi |
| Project context graph başladı | **Project Command Center** — tek operasyon ekranı |
| Sidecar: fs/terminal/notify | **Desktop Control Agent** — ekran okuma + onaylı UI aksiyonu |
| Eval smoke (trace compare) | **Eval Studio** — ölçülebilir agent kalitesi |
| Bireysel API key | **Team + integration packs** |

Değer ölçütü: *"Agent çalıştı mı?"* değil, *"Bu agent'ı güvenle tasarlayıp, ölçüp, maliyetini kontrol edip, gerekirse masaüstünde onaylı iş yaptırabilir miyim?"*

---

## Stratejik üçlü

```text
Agent Run Designer + Desktop Control Agent + Eval Studio
```

Bu üçlü birleşince platform şu konuma gelir:

> Güvenli, izlenebilir, test edilebilir ve yerel bilgisayarda iş yapabilen AI engineering agent platformu.

---

## Ürün ilkeleri (V4 ekleri)

1. **Observe before act** — Desktop aksiyonları önce okuma/öneri, sonra onaylı uygulama.
2. **Designable workflows** — Template JSON elle yazılmaz; UI'dan üretilir ve versiyonlanır.
3. **Measurable agents** — Her kritik workflow regression ve cost gate ile korunur.
4. **Project as command surface** — Kullanıcı proje bağlamında operasyon yapar, plugin listesinde değil.
5. **Team-ready by default** — Audit, approval ve secret modeli çok kullanıcıya hazır.

---

## Kullanıcı personaları (genişletilmiş)

| Persona | İhtiyaç | Ana yüzey (V4) |
|---------|---------|----------------|
| **Developer** | Workflow tasarla, self-healing fix | Run Designer + Self-Healing runs |
| **Tech lead** | Risk, maliyet, policy | Approval Pro + Cost Guardrails |
| **Platform admin** | Pack kurulumu, ekip audit | Integration Packs + Team settings |
| **Power user** | Masaüstü otomasyon | Desktop Control (sidecar) |

---

## Kapsam dışı (bilinçli)

- Tam otomatik production deploy (insan onayı olmadan)
- Consumer RPA (her uygulama için sınırsız UI otomasyon)
- Model training platformu

---

## Sonraki adım

[EXECUTION-ORDER.md](./EXECUTION-ORDER.md) → Faz V4.1: [01-platform-core-hardening.md](./01-platform-core-hardening.md)
