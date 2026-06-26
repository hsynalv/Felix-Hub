# 03 — Agent Run Designer

> **Status:** done  
> **Faz:** V4.3  
> **Bağımlılık:** [02-agent-runtime-v2.md](./02-agent-runtime-v2.md)

---

## Amaç

Workflow template yazmayı kod/dokümandan çıkarıp UI'a taşımak.

---

## Kapsam

- Görsel step listesi.
- Tool seçici.
- Input schema'dan otomatik form.
- Step input mapping.
- Condition builder.
- Approval checkpoint ekleme.
- Dry-run preview.
- Template save/version.
- Template'i MCP tool olarak publish etme.

---

## v3.4 köprüsü

`WorkflowTemplateDialog` — parametre formu, dry-run, repo preset. V4'te tam görsel designer'a genişler.

---

## Başarı kriteri

- [x] Kullanıcı UI'dan "repo-ship-feature" benzeri workflow oluşturup çalıştırabilir
- [x] Template JSON elle yazmak gerekmez

---

## Stratejik not

Run Designer, **stratejik üçlünün** bir parçası (Designer + Desktop + Eval).

---

## Sonraki

[04-approval-center-pro.md](./04-approval-center-pro.md)
