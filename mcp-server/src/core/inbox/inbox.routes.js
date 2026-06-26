/**
 * Agent Inbox HTTP + SSE routes (V6.6).
 */

import { requireScope } from "../auth.js";
import { listInboxItems, getInboxSummary } from "./inbox.service.js";
import { markInboxItemRead, snoozeInboxItem } from "./inbox-store.js";
import { subscribeInboxEvents } from "./inbox-events.js";

export function registerInboxRoutes(app) {
  app.get("/inbox/items", requireScope("read"), async (req, res) => {
    try {
      const types = req.query.types ? String(req.query.types).split(",") : null;
      const data = await listInboxItems({
        projectId: req.query.projectId || req.projectId,
        types,
        includeSnoozed: req.query.includeSnoozed === "true",
        includeRead: req.query.includeRead !== "false",
        limit: Number(req.query.limit) || 100,
      });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "inbox_list_failed", message: err.message } });
    }
  });

  app.get("/inbox/summary", requireScope("read"), async (req, res) => {
    try {
      const data = await getInboxSummary({ projectId: req.query.projectId || req.projectId });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "inbox_summary_failed", message: err.message } });
    }
  });

  app.post("/inbox/items/:id/read", requireScope("write"), (req, res) => {
    const itemId = decodeURIComponent(req.params.id);
    const state = markInboxItemRead(itemId);
    res.json({ ok: true, data: { itemId, state } });
  });

  app.post("/inbox/items/:id/snooze", requireScope("write"), (req, res) => {
    const itemId = decodeURIComponent(req.params.id);
    const minutes = Number(req.body?.minutes) || 60;
    const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    const state = snoozeInboxItem(itemId, until);
    res.json({ ok: true, data: { itemId, state, snoozedUntil: until } });
  });

  app.get("/inbox/stream", requireScope("read"), (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    send({ type: "connected", ts: new Date().toISOString() });

    const unsubscribe = subscribeInboxEvents((event) => send({ type: "inbox_update", ...event }));

    const heartbeat = setInterval(() => {
      send({ type: "heartbeat", ts: new Date().toISOString() });
    }, 25_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
