/**
 * SLA HTTP routes.
 */

import { requireScope } from "../auth.js";
import { getSlaPolicy, setSlaPolicy, listViolations, runSlaEvaluation, getSlaDashboard } from "./sla.service.js";
import { tickSla } from "./sla-runner.js";

export function registerSlaRoutes(app) {
  app.get("/sla/policy", requireScope("read"), (req, res) => {
    const projectId = req.query.projectId || req.projectId || "default";
    res.json({ ok: true, data: getSlaPolicy(projectId) });
  });

  app.put("/sla/policy", requireScope("write"), (req, res) => {
    try {
      const projectId = req.body?.projectId || req.projectId || "default";
      const policy = setSlaPolicy(projectId, req.body ?? {});
      res.json({ ok: true, data: policy });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: "policy_failed", message: err.message } });
    }
  });

  app.get("/sla/violations", requireScope("read"), (req, res) => {
    const violations = listViolations({
      projectId: req.query.projectId || req.projectId,
      limit: Number(req.query.limit) || 50,
    });
    res.json({ ok: true, data: { violations, count: violations.length } });
  });

  app.get("/sla/dashboard", requireScope("read"), (req, res) => {
    const data = getSlaDashboard({ projectId: req.query.projectId || req.projectId });
    res.json({ ok: true, data });
  });

  app.post("/sla/evaluate", requireScope("write"), async (_req, res) => {
    try {
      const data = await runSlaEvaluation();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "evaluate_failed", message: err.message } });
    }
  });

  app.post("/sla/tick", requireScope("write"), async (_req, res) => {
    try {
      const data = await tickSla();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "tick_failed", message: err.message } });
    }
  });
}
