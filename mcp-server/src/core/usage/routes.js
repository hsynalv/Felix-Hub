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

  app.get("/usage/preflight", requireScope("read"), async (req, res) => {
    try {
      const { preflightRunGuardrails, estimateTemplateCost } = await import("./cost-guardrails.service.js");
      const templateId = req.query.templateId;
      if (!templateId) {
        return res.status(400).json({
          ok: false,
          error: { code: "invalid_request", message: "templateId query param required" },
        });
      }
      let parameters = {};
      if (req.query.parameters) {
        try {
          parameters = JSON.parse(req.query.parameters);
        } catch {
          parameters = {};
        }
      }
      const projectId = req.query.projectId || req.projectId || null;
      const projectEnv = req.query.projectEnv || req.projectEnv || "development";
      const data = await preflightRunGuardrails({ templateId, parameters, projectId, projectEnv });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "preflight_failed", message: err.message } });
    }
  });

  app.get("/usage/anomalies", requireScope("read"), async (req, res) => {
    try {
      const { detectCostAnomalies } = await import("./cost-guardrails.service.js");
      const projectId = req.query.projectId || req.projectId || "default";
      const windowDays = Math.min(parseInt(req.query.windowDays, 10) || 7, 30);
      const data = await detectCostAnomalies(String(projectId), { windowDays });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "anomalies_failed", message: err.message } });
    }
  });

  app.post("/usage/guardrails/evaluate", requireScope("read"), async (req, res) => {
    try {
      const { evaluateCostPolicy } = await import("./cost-guardrails.service.js");
      const { toolName, estimatedCostUsd, projectEnv, projectId, costThresholdUsd } = req.body ?? {};
      if (!toolName) {
        return res.status(400).json({
          ok: false,
          error: { code: "invalid_request", message: "toolName required" },
        });
      }
      const data = evaluateCostPolicy({
        toolName,
        estimatedCostUsd: Number(estimatedCostUsd) || 0,
        projectEnv: projectEnv || req.projectEnv || "development",
        projectId: projectId || req.projectId,
        costThresholdUsd: costThresholdUsd != null ? Number(costThresholdUsd) : 2,
      });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "guardrail_eval_failed", message: err.message } });
    }
  });

  app.get("/usage/estimate/template/:templateId", requireScope("read"), async (req, res) => {
    try {
      const { estimateTemplateCost } = await import("./cost-guardrails.service.js");
      let parameters = {};
      if (req.query.parameters) {
        try {
          parameters = JSON.parse(req.query.parameters);
        } catch {
          parameters = {};
        }
      }
      const data = estimateTemplateCost(req.params.templateId, parameters);
      if (!data.ok) return res.status(404).json({ ok: false, error: data.error });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "estimate_failed", message: err.message } });
    }
  });
}
