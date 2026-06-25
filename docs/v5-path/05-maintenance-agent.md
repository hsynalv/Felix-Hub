# 05 — Dependency & Security Maintenance Agent

> **Status:** not_started  
> **Faz:** V5.5  
> **Bağımlılık:** [V4 Self-Healing](../v4-path/07-self-healing-dev-agent.md), [02-scheduled-agent-operations.md](./02-scheduled-agent-operations.md)

---

## Amaç

V4 self-healing'den farklı: **sürekli bakım agent'ı** — Dependabot'un daha akıllı versiyonu.

---

## Yapabilecekleri

- Outdated dependencies
- Vulnerability scan
- Breaking change summary
- Safe update PR
- Test run
- Risk score
- Rollback note

---

## Self-healing vs maintenance

| | Self-healing (V4) | Maintenance (V5) |
|---|-------------------|------------------|
| Tetik | CI/test failure | Schedule veya scan |
| Odak | Fix failing test | Proaktif güncelleme |
| Çıktı | Patch + PR | Risk skorlu update PR |

---

## Kapsam

- [ ] Maintenance runbook + schedule preset
- [ ] npm/cargo/go mod outdated scan
- [ ] Vulnerability feed (GitHub Advisory, OSV)
- [ ] Breaking change LLM özeti + changelog link
- [ ] Safe update PR (tek paket veya gruplu)
- [ ] Test run + risk score
- [ ] Autonomy: staging L3, production L2

---

## Başarı kriteri

- [ ] Haftalık scan outdated + vuln listesi ve risk skorlu PR önerisi üretir
- [ ] Yüksek risk güncelleme ekstra approval ister

---

## Sonraki

[09-workspace-hygiene-agent.md](./09-workspace-hygiene-agent.md)
