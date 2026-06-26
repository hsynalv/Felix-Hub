/**
 * Environment promotion HTTP routes.
 */

import { requireScope } from "../auth.js";
import {
  getEnvironmentRegistry,
  setEnvironmentRegistry,
  diffConfigs,
} from "./env-registry.service.js";
import {
  listPromotionRequests,
  getPromotionRequest,
  createPromotionRequest,
  approvePromotionStep,
  executePromotion,
} from "./promotion.service.js";

export function registerEnvRoutes(app) {
  app.get("/env/registry", requireScope("read"), (req, res) => {
    const projectId = req.query.projectId || req.projectId;
    if (!projectId) {
      return res.status(400).json({ ok: false, error: { code: "invalid", message: "projectId required" } });
    }
    res.json({ ok: true, data: getEnvironmentRegistry(projectId) });
  });

  app.put("/env/registry", requireScope("write"), (req, res) => {
    try {
      const projectId = req.body?.projectId || req.projectId;
      const data = setEnvironmentRegistry(projectId, req.body ?? {});
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "registry_failed", message: err.message } });
    }
  });

  app.post("/env/diff", requireScope("read"), (req, res) => {
    try {
      const { sourceConfig, targetConfig, fromEnv, toEnv, projectId } = req.body ?? {};
      let source = sourceConfig;
      let target = targetConfig;
      if (projectId && fromEnv && toEnv) {
        const registry = getEnvironmentRegistry(projectId);
        source = registry.environments[fromEnv]?.config;
        target = registry.environments[toEnv]?.config;
      }
      const data = diffConfigs(source, target);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: "diff_failed", message: err.message } });
    }
  });

  app.get("/env/promotions", requireScope("read"), (req, res) => {
    const requests = listPromotionRequests({
      projectId: req.query.projectId || req.projectId,
      status: req.query.status,
    });
    res.json({ ok: true, data: { requests, count: requests.length } });
  });

  app.get("/env/promotions/:id", requireScope("read"), (req, res) => {
    const request = getPromotionRequest(req.params.id);
    if (!request) {
      return res.status(404).json({ ok: false, error: { code: "not_found" } });
    }
    res.json({ ok: true, data: request });
  });

  app.post("/env/promotions", requireScope("write"), (req, res) => {
    try {
      const request = createPromotionRequest({
        ...req.body,
        projectId: req.body?.projectId || req.projectId,
        requestedBy: req.actor?.type || "api",
      });
      res.status(201).json({ ok: true, data: request });
    } catch (err) {
      const status = err.code === "invalid_promotion" ? 400 : 400;
      res.status(status).json({ ok: false, error: { code: err.code || "create_failed", message: err.message } });
    }
  });

  app.post("/env/promotions/:id/approve", requireScope("write"), (req, res) => {
    try {
      const request = approvePromotionStep(req.params.id, {
        role: req.body?.role,
        decision: req.body?.decision || "approve",
        actor: req.actor?.type || "api",
      });
      if (!request) {
        return res.status(404).json({ ok: false, error: { code: "not_found" } });
      }
      res.json({ ok: true, data: request });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "approve_failed", message: err.message } });
    }
  });

  app.post("/env/promotions/:id/execute", requireScope("write"), (req, res) => {
    try {
      const request = executePromotion(req.params.id);
      if (!request) {
        return res.status(404).json({ ok: false, error: { code: "not_found" } });
      }
      res.json({ ok: true, data: request });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "execute_failed", message: err.message } });
    }
  });
}
