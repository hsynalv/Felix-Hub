# 04 — Approval Center Pro

> **Status:** done  
> **Faz:** V4.4  
> **Bağımlılık:** [02-agent-runtime-v2.md](./02-agent-runtime-v2.md)

---

## Amaç

Riskli agent aksiyonlarını premium güvenlik deneyimine çevirmek.

---

## Kapsam

- Bekleyen approvals merkezi ekran.
- Risk skoru.
- Tool input/output diff.
- Secret-masked preview.
- Screenshot before/after desteği.
- Approve once / always for project / deny.
- Policy önerisi.
- Team approval altyapısına hazırlık.

---

## Özellikle korunan aksiyonlar

```text
shell_execute
git_push
database_write
workspace_delete_file
desktop_click
desktop_type
sidecar_terminal_exec
```

---

## Başarı kriteri

- [x] Riskli aksiyonlar onaysız çalışmaz
- [x] Onay kararları policy önerisine dönüşebilir

---

## Sonraki

[05-project-command-center.md](./05-project-command-center.md)
