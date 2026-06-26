/**
 * Briefing HTTP routes.
 */

import { requireScope } from "../auth.js";
import {
  listBriefings,
  getBriefingById,
  generateBriefing,
  deliverBriefing,
  generateAndDeliverDailyBrief,
  markBriefingRead,
  archiveBriefing,
  REPORT_TEMPLATES,
} from "./briefing.service.js";
import { renderBriefingHtml, renderBriefingPdfBuffer } from "./briefing-export.js";

export function registerBriefingRoutes(app) {
  app.get("/reports/templates", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: { templates: Object.values(REPORT_TEMPLATES) } });
  });

  app.get("/reports/briefings", requireScope("read"), (req, res) => {
    try {
      const briefings = listBriefings({
        projectId: req.projectId,
        archived: req.query.archived === "true",
        limit: Number(req.query.limit) || 50,
      });
      res.json({ ok: true, data: { briefings, count: briefings.length } });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "list_failed", message: err.message } });
    }
  });

  app.get("/reports/briefings/:id", requireScope("read"), (req, res) => {
    const briefing = getBriefingById(req.params.id);
    if (!briefing) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Briefing not found" } });
    }
    res.json({ ok: true, data: briefing });
  });

  app.post("/reports/generate", requireScope("write"), async (req, res) => {
    try {
      const projectId = req.body?.projectId || req.projectId;
      const type = req.body?.type || "daily_engineering";
      const briefing = await generateBriefing({ type, projectId });
      res.status(201).json({ ok: true, data: briefing });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "generate_failed", message: err.message } });
    }
  });

  app.post("/reports/briefings/:id/deliver", requireScope("write"), async (req, res) => {
    try {
      const data = await deliverBriefing(req.params.id, {
        channel: req.body?.channel || "native",
        target: req.body?.target,
      });
      const status = data.ok === false ? 404 : 200;
      res.status(status).json({ ok: data.ok !== false, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "deliver_failed", message: err.message } });
    }
  });

  app.post("/reports/daily", requireScope("write"), async (req, res) => {
    try {
      const projectId = req.body?.projectId || req.projectId;
      const data = await generateAndDeliverDailyBrief(projectId, { channel: req.body?.channel || "native" });
      res.status(201).json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "daily_failed", message: err.message } });
    }
  });

  app.patch("/reports/briefings/:id/read", requireScope("write"), (req, res) => {
    const briefing = markBriefingRead(req.params.id, req.body?.read !== false);
    if (!briefing) {
      return res.status(404).json({ ok: false, error: { code: "not_found" } });
    }
    res.json({ ok: true, data: briefing });
  });

  app.patch("/reports/briefings/:id/archive", requireScope("write"), (req, res) => {
    const briefing = archiveBriefing(req.params.id, req.body?.archived !== false);
    if (!briefing) {
      return res.status(404).json({ ok: false, error: { code: "not_found" } });
    }
    res.json({ ok: true, data: briefing });
  });

  app.get("/reports/briefings/:id/export.md", requireScope("read"), (req, res) => {
    const briefing = getBriefingById(req.params.id);
    if (!briefing) {
      return res.status(404).json({ ok: false, error: { code: "not_found" } });
    }
    const filename = `${briefing.type}-${briefing.id.slice(0, 8)}.md`;
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(briefing.markdown);
  });

  app.get("/reports/briefings/:id/export.html", requireScope("read"), (req, res) => {
    const briefing = getBriefingById(req.params.id);
    if (!briefing) {
      return res.status(404).json({ ok: false, error: { code: "not_found" } });
    }
    const filename = `${briefing.type}-${briefing.id.slice(0, 8)}.html`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(renderBriefingHtml(briefing));
  });

  app.get("/reports/briefings/:id/export.pdf", requireScope("read"), (req, res) => {
    const briefing = getBriefingById(req.params.id);
    if (!briefing) {
      return res.status(404).json({ ok: false, error: { code: "not_found" } });
    }
    const filename = `${briefing.type}-${briefing.id.slice(0, 8)}.pdf`;
    const pdf = renderBriefingPdfBuffer(briefing);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdf);
  });
}
