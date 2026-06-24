/**
 * Usage ledger HTTP routes
 */

import { requireScope } from "../auth.js";
import {
  queryEvents,
  querySummary,
  queryStats,
  queryConversationUsage,
  queryRunUsage,
  queryProjectUsage,
} from "./usage-ledger.service.js";
import { listQuotas, upsertQuota, checkQuota } from "./quota.service.js";

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
        runId: req.query.runId || undefined,
        projectId: req.query.projectId || req.projectId || undefined,
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

  app.get("/usage/runs/:id", requireScope("read"), async (req, res) => {
    try {
      const data = await queryRunUsage(req.params.id);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "usage_run_failed", message: err.message } });
    }
  });

  app.get("/usage/projects/:id", requireScope("read"), async (req, res) => {
    try {
      const days = Math.min(parseInt(req.query.days, 10) || 30, 90);
      const data = await queryProjectUsage(req.params.id, { days });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "usage_project_failed", message: err.message } });
    }
  });

  app.get("/usage/quotas", requireScope("read"), async (_req, res) => {
    try {
      const quotas = await listQuotas();
      res.json({ ok: true, data: { quotas } });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "quota_list_failed", message: err.message } });
    }
  });

  app.put("/usage/quotas", requireScope("admin"), async (req, res) => {
    try {
      const quota = await upsertQuota(req.body ?? {});
      res.json({ ok: true, data: quota });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "quota_upsert_failed", message: err.message } });
    }
  });

  app.get("/usage/quotas/check", requireScope("read"), async (req, res) => {
    try {
      const projectId = req.query.projectId || req.projectId || "default";
      const data = await checkQuota({ projectId: String(projectId) });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "quota_check_failed", message: err.message } });
    }
  });
}
