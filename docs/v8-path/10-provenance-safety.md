# 10 — Provenance & Safety

> **Status:** done (MVP)  
> **Bağımlılık:** [SOURCE-ARCHIVE.md](./SOURCE-ARCHIVE.md)

---

## Amaç

Prompt leak arşivi kullanırken lisans, marka ve güvenlik riskini yönetmek.

---

## Kurallar

1. **GPL arşiv** → ürün prompt’una verbatim paste yok; derived spec + review
2. **Identity** → yalnızca Felix Hub / Felix (`branding.js`)
3. **Provenance metadata** → her pattern: `sourceProvider`, `sourceFile`, `derivedAt`, `reviewer`, `risk: low|medium|high`
4. **High risk** → browser/desktop/shell bypass dili; import otomatik `disabled`
5. **Audit** → `prompt_create` / import işlemleri audit log

---

## Review checklist

- [ ] Vendor trademark yok (Cursor, Claude, …) production prompt’ta
- [ ] Felix dışı identity yok
- [ ] Tool bypass / “ignore policy” cümlesi yok
- [ ] Eval geçti

---

## Deliverables

- [ ] `provenance.json` şeması
- [ ] `CONTRIBUTING` veya `docs/v8-path/REVIEW.md` kısa rehber
- [ ] CI: banned phrase lint (opsiyonel)

---

## Başarı kriteri

- [ ] Tüm marketplace prompt’larında provenance kaydı dolu
