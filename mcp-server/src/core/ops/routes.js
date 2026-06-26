/**
 * V5 Ops routes — runbooks, schedules, autonomy policies.
 */

import { requireScope } from "../auth.js";
import {
  listRunbooks,
  getRunbookById,
  getRunbookVersions,
  createRunbook,
  updateRunbook,
  deleteRunbook,
  listRunbookExecutions,
  preflightRunbook,
  executeRunbook,
} from "./runbook.service.js";
import { assertRunbookForceAllowed } from "./runbook-force-guard.js";
import {
  listSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  pauseSchedule,
  listScheduleHistory,
  testFireSchedule,
  preflightSchedule,
} from "./schedule.service.js";
import { tickSchedules } from "./schedule-runner.js";
import {
  getAutonomyMatrix,
  setAutonomyPolicy,
  listAutonomyAudit,
  resolveAutonomyLevel,
  evaluateAutonomyForTool,
} from "./autonomy.service.js";
import { registerAutonomyToolHook } from "./autonomy-hook.js";

export function registerOpsRoutes(app) {
  registerAutonomyToolHook();

  // --- Runbooks ---
  app.get("/ops/runbooks", requireScope("read"), (req, res) => {
    try {
      const runbooks = listRunbooks({ projectId: req.projectId });
      res.json({ ok: true, data: { runbooks, count: runbooks.length } });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "list_failed", message: err.message } });
    }
  });

  app.get("/ops/runbooks/:id", requireScope("read"), (req, res) => {
    const runbook = getRunbookById(req.params.id);
    if (!runbook) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Runbook not found" } });
    }
    res.json({ ok: true, data: runbook });
  });

  app.get("/ops/runbooks/:id/versions", requireScope("read"), (req, res) => {
    const versions = getRunbookVersions(req.params.id);
    if (!versions) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Runbook not found" } });
    }
    res.json({ ok: true, data: { versions } });
  });

  app.get("/ops/runbooks/:id/executions", requireScope("read"), (req, res) => {
    const executions = listRunbookExecutions({ runbookId: req.params.id, limit: 100 });
    res.json({ ok: true, data: { executions } });
  });

  app.post("/ops/runbooks", requireScope("write"), (req, res) => {
    try {
      const runbook = createRunbook({ ...req.body, projectId: req.body?.projectId || req.projectId });
      res.status(201).json({ ok: true, data: runbook });
    } catch (err) {
      const status = err.code === "duplicate" ? 409 : 400;
      res.status(status).json({ ok: false, error: { code: err.code || "create_failed", message: err.message } });
    }
  });

  app.put("/ops/runbooks/:id", requireScope("write"), (req, res) => {
    try {
      const runbook = updateRunbook(req.params.id, req.body ?? {});
      if (!runbook) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Runbook not found" } });
      }
      res.json({ ok: true, data: runbook });
    } catch (err) {
      const status = err.code === "readonly" ? 403 : 400;
      res.status(status).json({ ok: false, error: { code: err.code || "update_failed", message: err.message } });
    }
  });

  app.delete("/ops/runbooks/:id", requireScope("write"), (req, res) => {
    try {
      const ok = deleteRunbook(req.params.id);
      if (!ok) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Runbook not found" } });
      }
      res.json({ ok: true, data: { deleted: true, id: req.params.id } });
    } catch (err) {
      const status = err.code === "readonly" ? 403 : 400;
      res.status(status).json({ ok: false, error: { code: err.code || "delete_failed", message: err.message } });
    }
  });

  app.post("/ops/runbooks/:id/preflight", requireScope("read"), async (req, res) => {
    try {
      const data = await preflightRunbook(req.params.id, {
        parameters: req.body?.parameters || {},
        projectId: req.projectId,
        projectEnv: req.projectEnv,
      });
      const status = data.ok === false ? 404 : 200;
      res.status(status).json({ ok: data.ok !== false, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "preflight_failed", message: err.message } });
    }
  });

  app.post("/ops/runbooks/:id/execute", requireScope("write"), async (req, res) => {
    try {
      const requestedForce = req.body?.force === true;
      if (requestedForce) {
        assertRunbookForceAllowed({ requested: true, authScopes: req.authScopes || [] });
      }
      const data = await executeRunbook(req.params.id, {
        parameters: req.body?.parameters || {},
        projectId: req.projectId,
        projectEnv: req.projectEnv,
        createdBy: req.actor?.type || "api",
        dryRun: req.body?.dryRun === true,
        force: requestedForce,
      });
      res.status(data.started ? 201 : 200).json({ ok: true, data });
    } catch (err) {
      const status = err.code === "force_forbidden" ? 403 : 400;
      res.status(status).json({ ok: false, error: { code: err.code || "execute_failed", message: err.message } });
    }
  });

  // --- Schedules ---
  app.get("/ops/schedules", requireScope("read"), (req, res) => {
    try {
      const schedules = listSchedules({ projectId: req.projectId });
      res.json({ ok: true, data: { schedules, count: schedules.length } });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "list_failed", message: err.message } });
    }
  });

  app.get("/ops/schedules/:id", requireScope("read"), (req, res) => {
    const schedule = getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Schedule not found" } });
    }
    res.json({ ok: true, data: schedule });
  });

  app.get("/ops/schedules/:id/history", requireScope("read"), (req, res) => {
    const history = listScheduleHistory({ scheduleId: req.params.id, limit: 100 });
    res.json({ ok: true, data: { history } });
  });

  app.post("/ops/schedules", requireScope("write"), (req, res) => {
    try {
      const schedule = createSchedule({ ...req.body, projectId: req.body?.projectId || req.projectId });
      res.status(201).json({ ok: true, data: schedule });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "create_failed", message: err.message } });
    }
  });

  app.put("/ops/schedules/:id", requireScope("write"), (req, res) => {
    try {
      const schedule = updateSchedule(req.params.id, req.body ?? {});
      if (!schedule) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Schedule not found" } });
      }
      res.json({ ok: true, data: schedule });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "update_failed", message: err.message } });
    }
  });

  app.post("/ops/schedules/:id/pause", requireScope("write"), (req, res) => {
    const schedule = pauseSchedule(req.params.id, req.body?.paused !== false);
    if (!schedule) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Schedule not found" } });
    }
    res.json({ ok: true, data: schedule });
  });

  app.delete("/ops/schedules/:id", requireScope("write"), (req, res) => {
    const ok = deleteSchedule(req.params.id);
    if (!ok) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Schedule not found" } });
    }
    res.json({ ok: true, data: { deleted: true, id: req.params.id } });
  });

  app.post("/ops/schedules/:id/preflight", requireScope("read"), async (req, res) => {
    try {
      const data = await preflightSchedule(req.params.id);
      const status = data.ok === false ? 404 : 200;
      res.status(status).json({ ok: data.ok !== false, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "preflight_failed", message: err.message } });
    }
  });

  app.post("/ops/schedules/:id/test-fire", requireScope("write"), async (req, res) => {
    try {
      const data = await testFireSchedule(req.params.id);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: "test_fire_failed", message: err.message } });
    }
  });

  app.post("/ops/schedules/tick", requireScope("write"), async (req, res) => {
    try {
      const data = await tickSchedules();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "tick_failed", message: err.message } });
    }
  });

  // --- Autonomy ---
  app.get("/ops/autonomy", requireScope("read"), (req, res) => {
    try {
      const matrix = getAutonomyMatrix(req.projectId);
      res.json({ ok: true, data: matrix });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "matrix_failed", message: err.message } });
    }
  });

  app.put("/ops/autonomy", requireScope("write"), (req, res) => {
    try {
      const projectId = req.body?.projectId || req.projectId;
      if (!projectId) {
        return res.status(400).json({ ok: false, error: { code: "invalid", message: "projectId required" } });
      }
      const matrix = setAutonomyPolicy(projectId, req.body ?? {}, { actor: req.actor?.type || "api" });
      res.json({ ok: true, data: matrix });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "policy_failed", message: err.message } });
    }
  });

  app.get("/ops/autonomy/audit", requireScope("read"), (req, res) => {
    try {
      const audit = listAutonomyAudit({ projectId: req.projectId, limit: 100 });
      res.json({ ok: true, data: { audit } });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "audit_failed", message: err.message } });
    }
  });

  app.post("/ops/autonomy/evaluate-tool", requireScope("read"), (req, res) => {
    try {
      const { toolName, projectEnv, estimatedCostUsd, maxCostUsd, level } = req.body ?? {};
      if (!toolName) {
        return res.status(400).json({ ok: false, error: { code: "invalid", message: "toolName required" } });
      }
      const resolved = resolveAutonomyLevel({
        projectId: req.projectId,
        projectEnv: projectEnv || req.projectEnv,
        explicitLevel: level,
      });
      const result = evaluateAutonomyForTool({
        level: resolved,
        toolName,
        projectEnv: projectEnv || req.projectEnv,
        projectId: req.projectId,
        estimatedCostUsd,
        maxCostUsd,
      });
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: "evaluate_failed", message: err.message } });
    }
  });
}
