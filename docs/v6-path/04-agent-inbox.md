# 04 — Agent Inbox

> **Status:** not_started  
> **Faz:** V6.6  
> **Bağımlılık:** [V5 SLA & Escalation](../v5-path/07-sla-escalation.md), [V4 Approval Center Pro](../v4-path/04-approval-center-pro.md)

---

## Amaç

Agent'ın kullanıcıya sorduğu, beklettiği, raporladığı her şey için merkezi inbox.

---

## Inbox öğe türleri

- Approval bekleyenler
- "Karar vermen gerekiyor"
- "Şu PR hazır"
- "Bu run başarısız oldu"
- "Bu maliyet limitine takıldı"
- "Bu memory conflict oldu"

Approval Center'ın daha geniş versiyonu: sadece onay değil, tüm agent ↔ kullanıcı iletişimi.

---

## Kapsam

- [ ] `inbox_items` modeli (type, priority, run_id, payload, read_at)
- [ ] Unified inbox API + SSE push
- [ ] Inbox UI: filtre, snooze, bulk action
- [ ] Approval Pro'dan inbox'a migrate (tek yüzey)
- [ ] Desktop/sidecar bildirim köprüsü (opsiyonel)

---

## Başarı kriteri

- [ ] Kullanıcı tek ekranda tüm bekleyen agent aksiyonlarını görür
- [ ] Watcher + approval + failure + cost limit aynı inbox'ta

---

## Sonraki

[05-knowledge-conflict-resolver.md](./05-knowledge-conflict-resolver.md)
