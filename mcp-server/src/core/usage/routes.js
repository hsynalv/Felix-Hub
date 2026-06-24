/**
 * Usage ledger HTTP routes
 */

import { requireScope } from "../auth.js";
import {
  queryEvents,
  querySummary,
  queryStats,
  queryConversationUsage,
} from "./usage-ledger.service.js";

function parseDateParam(val) {
  if (!val) return undefined;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function registerUsageRoutes(app) {
  app.get("/usage/events", requireScope("read"), async (req, res) => {
    try {
      const data = await queryEvents({
        from: parseDateParam(req.query.from),
        to: parseDateParam(req.query.to),
        tool: req.query.tool || undefined,
        source: req.query.source || undefined,
        model: req.query.model || undefined,
        conversationId: req.query.conversationId || undefined,
        limit: parseInt(req.query.limit, 10) || 50,
        offset: parseInt(req.query.offset, 10) || 0,
      });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "usage_events_failed", message: err.message } });
    }
  });

  app.get("/usage/summary", requireScope("read"), async (req, res) => {
    try {
      const groupBy = req.query.groupBy || "tool";
      const data = await querySummary({
        from: parseDateParam(req.query.from),
        to: parseDateParam(req.query.to),
        groupBy,
      });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "usage_summary_failed", message: err.message } });
    }
  });

  app.get("/usage/stats", requireScope("read"), async (req, res) => {
    try {
      const days = Math.min(parseInt(req.query.days, 10) || 7, 90);
      const data = await queryStats({ days });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "usage_stats_failed", message: err.message } });
    }
  });

  app.get("/usage/conversations/:id", requireScope("read"), async (req, res) => {
    try {
      const data = await queryConversationUsage(req.params.id);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "usage_conversation_failed", message: err.message } });
    }
  });
}
