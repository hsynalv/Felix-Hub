/**
 * V6 Faz C HTTP routes — App Store, Compliance, NL Admin, Conflicts, Operating Model.
 */

import { requireScope } from "../auth.js";
import {
  getProductCatalogEnriched,
  previewInstall,
  installAgentProduct,
  uninstallAgentProduct,
} from "./app-store.service.js";
import { listInstallations } from "./app-store-store.js";
import {
  getCompliancePolicy,
  setCompliancePolicy,
  exportAuditLog,
  getComplianceAdminReport,
} from "./compliance.service.js";
import { parseNLAdminCommand, executeNLAdminCommand, listNLAdminIntents } from "./nl-admin.service.js";
import { detectConflicts, listStoredConflicts, resolveConflict, getConflictReport } from "./conflict.service.js";
import {
  listPreferences,
  rememberPreference,
  forgetPreference,
  pinPreference,
  exportOperatingModel,
} from "./operating-model-store.js";

export function registerV6PhaseCRoutes(app) {
  // ── App Store (6.8) ───────────────────────────────────────────────────────
  app.get("/app-store/products", requireScope("read"), (req, res) => {
    const products = getProductCatalogEnriched({ projectId: req.query.projectId || req.projectId });
    res.json({ ok: true, data: { products, count: products.length } });
  });

  app.get("/app-store/installations", requireScope("read"), (req, res) => {
    const installations = listInstallations({ projectId: req.query.projectId || req.projectId });
    res.json({ ok: true, data: { installations, count: installations.length } });
  });

  app.get("/app-store/products/:id/preview", requireScope("read"), (req, res) => {
    try {
      const data = previewInstall(req.params.id, { projectId: req.query.projectId || req.projectId || "default" });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(err.code === "not_found" ? 404 : 400).json({
        ok: false,
        error: { code: err.code || "preview_failed", message: err.message },
      });
    }
  });

  app.post("/app-store/products/:id/install", requireScope("write"), async (req, res) => {
    try {
      const data = await installAgentProduct(req.params.id, {
        projectId: req.body?.projectId || req.projectId || "default",
        installedBy: req.body?.installedBy || "api",
        confirmPolicy: req.body?.confirmPolicy !== false,
      });
      res.status(201).json({ ok: true, data });
    } catch (err) {
      const status =
        err.code === "not_found" ? 404 : err.code === "already_installed" ? 409 : err.code === "missing_integrations" ? 400 : 500;
      res.status(status).json({
        ok: false,
        error: { code: err.code || "install_failed", message: err.message, missing: err.missing },
      });
    }
  });

  app.post("/app-store/products/:id/uninstall", requireScope("write"), (req, res) => {
    try {
      const data = uninstallAgentProduct(req.params.id, {
        projectId: req.body?.projectId || req.projectId || "default",
      });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(err.code === "not_found" ? 404 : 400).json({
        ok: false,
        error: { code: err.code || "uninstall_failed", message: err.message },
      });
    }
  });

  // ── Compliance (6.9) ──────────────────────────────────────────────────────
  app.get("/compliance/policy", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: getCompliancePolicy() });
  });

  app.put("/compliance/policy", requireScope("admin"), (req, res) => {
    try {
      const policy = setCompliancePolicy(req.body ?? {});
      res.json({ ok: true, data: policy });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: "policy_failed", message: err.message } });
    }
  });

  app.get("/compliance/report", requireScope("read"), async (req, res) => {
    try {
      const data = await getComplianceAdminReport({ projectId: req.query.projectId || req.projectId });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "report_failed", message: err.message } });
    }
  });

  app.get("/compliance/audit/export", requireScope("admin"), async (req, res) => {
    try {
      const data = await exportAuditLog({
        from: req.query.from,
        to: req.query.to,
        actor: req.query.actor,
        source: req.query.source,
        format: req.query.format || "json",
        limit: Number(req.query.limit) || 500,
      });
      if (data.format === "csv") {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=audit-export.csv");
        return res.send(data.content);
      }
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "export_failed", message: err.message } });
    }
  });

  // ── NL Admin (6.10) ───────────────────────────────────────────────────────
  app.get("/nl-admin/intents", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: { intents: listNLAdminIntents() } });
  });

  app.post("/nl-admin/parse", requireScope("read"), (req, res) => {
    const result = parseNLAdminCommand(req.body?.command || req.body?.text || "", {
      projectId: req.body?.projectId || req.projectId || "default",
    });
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  });

  app.post("/nl-admin/execute", requireScope("admin"), async (req, res) => {
    try {
      const result = await executeNLAdminCommand(req.body?.command || req.body?.text || "", {
        projectId: req.body?.projectId || req.projectId || "default",
        confirm: req.body?.confirm === true,
        actor: req.actor?.type || "nl-admin",
      });
      if (!result.ok) return res.status(result.error?.code === "confirmation_required" ? 428 : 400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "execute_failed", message: err.message } });
    }
  });

  // ── Conflict Resolver (6.11) ──────────────────────────────────────────────
  app.get("/conflicts", requireScope("read"), (req, res) => {
    const conflicts = listStoredConflicts({
      projectId: req.query.projectId || req.projectId,
      status: req.query.status,
    });
    res.json({ ok: true, data: { conflicts, count: conflicts.length } });
  });

  app.post("/conflicts/detect", requireScope("write"), async (req, res) => {
    try {
      const data = await detectConflicts({
        topic: req.body?.topic,
        projectId: req.body?.projectId || req.projectId,
        workspacePath: req.body?.workspacePath || ".",
      });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(err.code === "invalid" ? 400 : 500).json({
        ok: false,
        error: { code: err.code || "detect_failed", message: err.message },
      });
    }
  });

  app.get("/conflicts/:id", requireScope("read"), (req, res) => {
    const conflict = getConflictReport(req.params.id);
    if (!conflict) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Conflict not found" } });
    }
    res.json({ ok: true, data: conflict });
  });

  app.post("/conflicts/:id/resolve", requireScope("write"), (req, res) => {
    const conflict = resolveConflict(req.params.id, {
      acceptedSource: req.body?.acceptedSource,
      pin: !!req.body?.pin,
      resolvedBy: req.body?.resolvedBy || "api",
    });
    if (!conflict) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Conflict not found" } });
    }
    res.json({ ok: true, data: conflict });
  });

  // ── Operating Model (6.12) ────────────────────────────────────────────────
  app.get("/operating-model/preferences", requireScope("read"), (req, res) => {
    const preferences = listPreferences({
      scope: req.query.scope,
      projectId: req.query.projectId || req.projectId,
    });
    res.json({ ok: true, data: { preferences, count: preferences.length } });
  });

  app.post("/operating-model/remember", requireScope("write"), (req, res) => {
    try {
      const pref = rememberPreference({
        scope: req.body?.scope || "global",
        projectId: req.body?.projectId || req.projectId,
        key: req.body?.key,
        value: req.body?.value,
        pinned: !!req.body?.pinned,
        source: req.body?.source || "explicit",
      });
      res.status(201).json({ ok: true, data: pref });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "remember_failed", message: err.message } });
    }
  });

  app.delete("/operating-model/preferences/:id", requireScope("write"), (req, res) => {
    try {
      const deleted = forgetPreference(req.params.id);
      if (!deleted) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Preference not found" } });
      }
      res.json({ ok: true, data: { deleted: true } });
    } catch (err) {
      res.status(err.code === "forbidden" ? 403 : 400).json({
        ok: false,
        error: { code: err.code || "forget_failed", message: err.message },
      });
    }
  });

  app.post("/operating-model/preferences/:id/pin", requireScope("write"), (req, res) => {
    const pref = pinPreference(req.params.id, req.body?.pinned !== false);
    if (!pref) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Preference not found" } });
    }
    res.json({ ok: true, data: pref });
  });

  app.get("/operating-model/export", requireScope("read"), (req, res) => {
    const data = exportOperatingModel({ projectId: req.query.projectId || req.projectId });
    res.json({ ok: true, data });
  });
}
