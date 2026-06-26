# 01 — Platform Çekirdeğini Sertleştir

> **Status:** done  
> **Faz:** V4.1  
> **Bağımlılık:** V3 Faz 0–5 tamamlandı

---

## Amaç

Agent'ların güvenli ve stabil koşacağı omurgayı netleştirmek.

---

## Kapsam

- Tek registry: `tool-registry.js` authoritative olsun.
- Tek jobs modeli: `jobs.js` ana kaynak, eski manager deprecate.
- Tek audit entrypoint.
- Tool schema/tag warning'leri sıfırla.
- `correlationId must be string` audit uyarılarını düzelt.
- Testlerde full server init tekrarını azalt.
- `jobs-api.test.js` hızlandırılsın.

---

## v3.4'te başlayanlar

| Madde | Durum |
|-------|-------|
| `jobs-api.test.js` beforeAll + persistence-off | done |
| `ToolTags.READ` / `DATABASE` alias | done |
| `isStrictToolSchema()` config wire | done |
| Tek `generateCorrelationId` + normalize | done |
| Migration skip applied versions | done |

---

## Kalan işler

- [x] `job.manager.js` deprecation path + tüm import'lar `jobs.js`'e
- [x] Audit tek entrypoint dokümantasyonu + kalan çift çağrılar
- [x] `STRICT_TOOL_SCHEMA=true` CI gate
- [x] Startup warning audit — gerçek risk dışı temizlik
- [x] Test fixture paylaşımı genişletme (diğer yavaş suite'ler)

---

## Başarı kriteri

- [x] `npm run test:run` exit 0
- [x] Test süresi makul seviyede (jobs-api < 5s hedef)
- [x] Startup warning'leri gerçek risk dışında temiz

---

## Sonraki

[02-agent-runtime-v2.md](./02-agent-runtime-v2.md)
