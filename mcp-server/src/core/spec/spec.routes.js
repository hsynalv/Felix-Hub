/**
 * Spec workflow HTTP routes — V8 Faz C.
 */

import { requireScope } from "../auth.js";
import {
  startSpecSession,
  advanceSpecSession,
  getSpecSessionDetail,
  updateSpecArtifact,
  listSpecSessions,
} from "./spec-session.service.js";

export function registerSpecRoutes(app) {
  app.get("/spec/sessions", requireScope("read"), async (req, res) => {
    try {
      const sessions = await listSpecSessions({
        projectId: req.query.projectId || null,
        limit: parseInt(req.query.limit || "50", 10),
      });
      res.json({ ok: true, data: { sessions, count: sessions.length } });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "spec_list_failed", message: err.message } });
    }
  });

  app.post("/spec/sessions", requireScope("write"), async (req, res) => {
    try {
      const session = await startSpecSession({
        title: req.body?.title,
        idea: req.body?.idea,
        projectId: req.body?.projectId || req.projectId || null,
      });
      res.status(201).json({ ok: true, data: session });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "spec_create_failed", message: err.message } });
    }
  });

  app.get("/spec/sessions/:id", requireScope("read"), async (req, res) => {
    const result = await getSpecSessionDetail(req.params.id);
    res.status(result.ok ? 200 : 404).json(result);
  });

  app.post("/spec/sessions/:id/advance", requireScope("write"), async (req, res) => {
    try {
      const result = await advanceSpecSession(req.params.id, {
        content: req.body?.content,
        stage: req.body?.stage,
        autoSkeleton: req.body?.autoSkeleton !== false,
      });
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "spec_advance_failed", message: err.message } });
    }
  });

  app.put("/spec/sessions/:id/artifacts/:stage", requireScope("write"), async (req, res) => {
    try {
      const result = await updateSpecArtifact(req.params.id, req.params.stage, req.body?.content);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "spec_artifact_failed", message: err.message } });
    }
  });
}
