# 11 — Enterprise Compliance Pack

> **Status:** mvp_done  
> **Faz:** V6.9  
> **Bağımlılık:** [V4 Team packs](../v4-path/10-team-marketplace-packs.md), [12-agent-observability-pro.md](./12-agent-observability-pro.md)

---

## Amaç

Kurumsal kullanım için uyumluluk ve yönetişim paketi.

---

## Kapsam

- Audit export
- SOC2-style logs
- Data retention policy
- PII/secret redaction
- Per-tenant encryption keys
- SSO/OIDC
- SCIM
- Legal hold
- Admin reports

---

## Teknik notlar

- Mevcut audit archive API üzerine export formatları
- Settings encryption (V3) → per-tenant key rotation
- Agent run logs retention tier (hot/warm/cold)

---

## Başarı kriteri

- [ ] Admin audit export (CSV/JSON) tarih aralığı + actor filtresiyle alınır
- [ ] SSO ile giriş + SCIM ile kullanıcı provision (MVP)
- [ ] Retention policy agent run ve audit için uygulanır

---

## Sonraki

[12-agent-observability-pro.md](./12-agent-observability-pro.md)
