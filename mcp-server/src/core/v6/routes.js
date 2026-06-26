/**
 * V6 ecosystem HTTP routes (Faz A).
 */

import { requireScope } from "../auth.js";
import { listAgentRoles } from "./agent-roles.js";
import {
  createParentRun,
  spawnChildRun,
  listChildRuns,
  getParentAggregate,
} from "./multi-agent.service.js";
import { listSkills, getSkillById, createSkill, updateSkill, deleteSkill } from "./skill-store.js";
import { compileSkillToWorkflow, runSkillMultiAgent } from "./skill.service.js";
import {
  listWatchers,
  getWatcherById,
  createWatcher,
  updateWatcher,
  deleteWatcher,
  listWatcherHistory,
} from "./watcher-store.js";
import { dispatchWatcherEvent, testFireWatcher } from "./watcher.service.js";
import {
  listSandboxSessions,
  getSandboxSession,
  createSandboxSession,
  updateSandboxSession,
  closeSandboxSession,
} from "./sandbox-store.js";
import { listTrustScores, getTrustScore, recalculateTrustScores } from "./trust.service.js";

export function registerV6Routes(app) {
  // ── Multi-agent ───────────────────────────────────────────────────────────
  app.get("/multi-agent/roles", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: { roles: listAgentRoles() } });
  });

  app.post("/multi-agent/parents", requireScope("write"), async (req, res) => {
    try {
      const run = await createParentRun({
        goal: req.body?.goal,
        projectId: req.body?.projectId || req.projectId,
        conversationId: req.body?.conversationId,
        createdBy: req.body?.createdBy || "api",
        metadata: req.body?.metadata,
      });
      res.status(201).json({ ok: true, data: run });
    } catch (err) {
      res.status(err.code === "invalid" ? 400 : 500).json({
        ok: false,
        error: { code: err.code || "create_failed", message: err.message },
      });
    }
  });

  app.get("/multi-agent/parents/:id/children", requireScope("read"), async (req, res) => {
    const children = await listChildRuns(req.params.id);
    res.json({ ok: true, data: { children, count: children.length } });
  });

  app.get("/multi-agent/parents/:id/aggregate", requireScope("read"), async (req, res) => {
    const aggregate = await getParentAggregate(req.params.id);
    if (!aggregate) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Parent run not found" } });
    }
    res.json({ ok: true, data: aggregate });
  });

  app.post("/multi-agent/parents/:id/spawn", requireScope("write"), async (req, res) => {
    try {
      const child = await spawnChildRun(req.params.id, {
        role: req.body?.role,
        goal: req.body?.goal,
        handoff: req.body?.handoff,
        skillId: req.body?.skillId,
        templateId: req.body?.templateId,
        projectId: req.body?.projectId || req.projectId,
        createdBy: req.body?.createdBy || "api",
        dryRun: !!req.body?.dryRun,
        parameters: req.body?.parameters,
      });
      res.status(201).json({ ok: true, data: child });
    } catch (err) {
      const status = err.code === "not_found" ? 404 : err.code === "invalid_role" ? 400 : 500;
      res.status(status).json({ ok: false, error: { code: err.code || "spawn_failed", message: err.message } });
    }
  });

  // ── Skills ────────────────────────────────────────────────────────────────
  app.get("/skills", requireScope("read"), (req, res) => {
    const skills = listSkills({
      projectId: req.query.projectId || req.projectId,
      tag: req.query.tag,
    });
    res.json({ ok: true, data: { skills, count: skills.length } });
  });

  app.get("/skills/:id", requireScope("read"), (req, res) => {
    const skill = getSkillById(req.params.id);
    if (!skill) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Skill not found" } });
    }
    res.json({ ok: true, data: skill });
  });

  app.post("/skills", requireScope("write"), (req, res) => {
    try {
      const skill = createSkill({ ...req.body, projectId: req.body?.projectId || req.projectId });
      res.status(201).json({ ok: true, data: skill });
    } catch (err) {
      res.status(err.code === "conflict" ? 409 : 400).json({
        ok: false,
        error: { code: err.code || "create_failed", message: err.message },
      });
    }
  });

  app.put("/skills/:id", requireScope("write"), (req, res) => {
    try {
      const skill = updateSkill(req.params.id, req.body ?? {});
      if (!skill) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Skill not found" } });
      }
      res.json({ ok: true, data: skill });
    } catch (err) {
      res.status(err.code === "forbidden" ? 403 : 400).json({
        ok: false,
        error: { code: err.code || "update_failed", message: err.message },
      });
    }
  });

  app.delete("/skills/:id", requireScope("write"), (req, res) => {
    try {
      const deleted = deleteSkill(req.params.id);
      if (!deleted) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Skill not found" } });
      }
      res.json({ ok: true, data: { deleted: true } });
    } catch (err) {
      res.status(err.code === "forbidden" ? 403 : 400).json({
        ok: false,
        error: { code: err.code || "delete_failed", message: err.message },
      });
    }
  });

  app.post("/skills/:id/compile", requireScope("read"), (req, res) => {
    try {
      const compiled = compileSkillToWorkflow(req.params.id, req.body?.parameters || {});
      res.json({ ok: true, data: compiled });
    } catch (err) {
      res.status(err.code === "not_found" ? 404 : 400).json({
        ok: false,
        error: { code: err.code || "compile_failed", message: err.message },
      });
    }
  });

  app.post("/skills/:id/run", requireScope("write"), async (req, res) => {
    try {
      const result = await runSkillMultiAgent(req.params.id, req.body?.parameters || {}, {
        projectId: req.body?.projectId || req.projectId,
        createdBy: req.body?.createdBy || "api",
        dryRun: !!req.body?.dryRun,
      });
      res.status(201).json({ ok: true, data: result });
    } catch (err) {
      res.status(err.code === "not_found" ? 404 : 400).json({
        ok: false,
        error: { code: err.code || "run_failed", message: err.message },
      });
    }
  });

  // ── Watchers ──────────────────────────────────────────────────────────────
  app.get("/watchers", requireScope("read"), (req, res) => {
    const watchers = listWatchers({
      projectId: req.query.projectId || req.projectId,
      enabled: req.query.enabled === "true" ? true : req.query.enabled === "false" ? false : null,
    });
    res.json({ ok: true, data: { watchers, count: watchers.length } });
  });

  app.get("/watchers/history", requireScope("read"), (req, res) => {
    const history = listWatcherHistory({
      watcherId: req.query.watcherId,
      limit: Number(req.query.limit) || 50,
    });
    res.json({ ok: true, data: { history, count: history.length } });
  });

  app.get("/watchers/:id", requireScope("read"), (req, res) => {
    const watcher = getWatcherById(req.params.id);
    if (!watcher) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Watcher not found" } });
    }
    res.json({ ok: true, data: watcher });
  });

  app.post("/watchers", requireScope("write"), (req, res) => {
    try {
      const watcher = createWatcher({ ...req.body, projectId: req.body?.projectId || req.projectId });
      res.status(201).json({ ok: true, data: watcher });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "create_failed", message: err.message } });
    }
  });

  app.put("/watchers/:id", requireScope("write"), (req, res) => {
    const watcher = updateWatcher(req.params.id, req.body ?? {});
    if (!watcher) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Watcher not found" } });
    }
    res.json({ ok: true, data: watcher });
  });

  app.delete("/watchers/:id", requireScope("write"), (req, res) => {
    const deleted = deleteWatcher(req.params.id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Watcher not found" } });
    }
    res.json({ ok: true, data: { deleted: true } });
  });

  app.post("/watchers/:id/test-fire", requireScope("write"), async (req, res) => {
    try {
      const result = await testFireWatcher(req.params.id, req.body ?? {});
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(err.code === "not_found" ? 404 : 500).json({
        ok: false,
        error: { code: err.code || "test_fire_failed", message: err.message },
      });
    }
  });

  app.post("/watchers/dispatch", requireScope("write"), async (req, res) => {
    try {
      const result = await dispatchWatcherEvent({
        ...req.body,
        projectId: req.body?.projectId || req.projectId,
      });
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "dispatch_failed", message: err.message } });
    }
  });

  // ── Sandbox ───────────────────────────────────────────────────────────────
  app.get("/sandbox/sessions", requireScope("read"), (req, res) => {
    const sessions = listSandboxSessions({
      projectId: req.query.projectId || req.projectId,
      status: req.query.status,
    });
    res.json({ ok: true, data: { sessions, count: sessions.length } });
  });

  app.get("/sandbox/sessions/:id", requireScope("read"), (req, res) => {
    const session = getSandboxSession(req.params.id);
    if (!session) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Session not found" } });
    }
    res.json({ ok: true, data: session });
  });

  app.post("/sandbox/sessions", requireScope("write"), (req, res) => {
    const session = createSandboxSession({
      name: req.body?.name,
      projectId: req.body?.projectId || req.projectId,
      mocks: req.body?.mocks,
    });
    res.status(201).json({ ok: true, data: session });
  });

  app.put("/sandbox/sessions/:id", requireScope("write"), (req, res) => {
    const session = updateSandboxSession(req.params.id, req.body ?? {});
    if (!session) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Session not found" } });
    }
    res.json({ ok: true, data: session });
  });

  app.post("/sandbox/sessions/:id/close", requireScope("write"), (req, res) => {
    const session = closeSandboxSession(req.params.id);
    if (!session) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Session not found" } });
    }
    res.json({ ok: true, data: session });
  });

  // ── Trust ─────────────────────────────────────────────────────────────────
  app.get("/trust/scores", requireScope("read"), (req, res) => {
    const scores = listTrustScores({
      entityType: req.query.entityType,
      minScore: req.query.minScore != null ? Number(req.query.minScore) : null,
    });
    res.json({ ok: true, data: { scores, count: scores.length } });
  });

  app.get("/trust/scores/:entityType/:entityId", requireScope("read"), (req, res) => {
    const score = getTrustScore(req.params.entityType, req.params.entityId);
    res.json({ ok: true, data: score });
  });

  app.post("/trust/recalculate", requireScope("write"), async (req, res) => {
    try {
      const scores = await recalculateTrustScores({
        projectId: req.body?.projectId || req.projectId,
        limit: req.body?.limit,
      });
      res.json({ ok: true, data: { scores, count: scores.length } });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "recalculate_failed", message: err.message } });
    }
  });
}
