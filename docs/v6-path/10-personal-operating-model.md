# 10 — Personal Operating Model

> **Status:** mvp_done  
> **Faz:** V6.12  
> **Bağımlılık:** [04-agent-inbox.md](./04-agent-inbox.md), [V4 workspace preferences](../v4-path/05-project-command-center.md)

---

## Amaç

Agent kullanıcının çalışma tarzını öğrensin — ama memory **explicit ve yönetilebilir** olsun.

---

## Öğrenilebilir tercihler

- Sabah özet formatı
- PR review tercihleri
- Kod stili
- Risk toleransı
- Hangi tool'lara ne zaman izin verildiği
- Hangi projelerde hangi model tercih edildiği

---

## Yönetim API'si

```text
remember / forget / pin / edit
```

Gizli profil yok; kullanıcı her tercihi görebilir ve silebilir.

---

## Kapsam

- [ ] `user_operating_model` store (scoped: global / project)
- [ ] Explicit remember tool + UI
- [ ] Pin: değiştirilemez tercihler
- [ ] Agent prompt injection: operating model context
- [ ] Export / import (GDPR-friendly)
- [ ] Conflict Resolver ile çakışma kontrolü

---

## Başarı kriteri

- [ ] Kullanıcı "PR review'da test coverage iste" der, agent sonraki run'larda uygular
- [ ] Tüm tercihler listelenir, tek tek silinebilir

---

## Sonraki

[11-enterprise-compliance-pack.md](./11-enterprise-compliance-pack.md)
