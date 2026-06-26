/**
 * V7 — Personal OS HTTP routes.
 */

import { requireScope } from "../auth.js";
import { getPersonalCommandCenter } from "./personal-command-center.service.js";
import { buildPersonalBriefing } from "./personal-briefing.service.js";
import {
  generateDailyBriefing,
  getTodayBriefingRecord,
} from "./daily-briefing.service.js";
import { listBriefingSources } from "./briefing-sources.js";
import {
  listPersonalMemory,
  rememberPersonal,
  forgetPersonal,
  pinPersonal,
  exportPersonalMemory,
} from "./personal-memory.service.js";
import { getHubPauseState } from "./telegram-pause.js";
import {
  getPersonalDesktopStatus,
  getDesktopAllowlist,
  updateDesktopAllowlist,
  capturePersonalDesktopPreview,
  readPersonalSidecarFile,
  listPersonalSidecarDir,
} from "./personal-desktop.service.js";
import {
  getPersonalAutonomyState,
  setPersonalAutonomyPreset,
  PERSONAL_PRESETS,
} from "./personal-autonomy.service.js";
import {
  getOpsDashboard,
  updateOpsLimits,
  triggerEmergencyStop,
  clearEmergencyStop,
} from "./personal-ops.service.js";
import { registerPersonalOpsHook } from "./personal-ops-hook.js";

export function registerV7Routes(app) {
  registerPersonalOpsHook();
  app.get("/personal/command-center", requireScope("read"), async (req, res) => {
    try {
      const scope = req.query.scope === "project" ? "project" : "personal";
      const projectKey = req.query.projectKey || req.query.projectId || req.projectId || null;
      const data = await getPersonalCommandCenter({
        scope,
        projectKey,
        projectId: projectKey,
      });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: { code: "personal_command_center_failed", message: err.message },
      });
    }
  });

  app.get("/personal/briefing/today", requireScope("read"), async (req, res) => {
    try {
      const scope = req.query.scope === "project" ? "project" : "personal";
      const projectId = req.query.projectKey || req.query.projectId || req.projectId || null;
      const data = await buildPersonalBriefing({
        scope,
        projectId: scope === "project" ? projectId : null,
      });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: { code: "personal_briefing_failed", message: err.message },
      });
    }
  });

  app.get("/personal/briefing/sources", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: { sources: listBriefingSources() } });
  });

  app.get("/personal/briefing/latest", requireScope("read"), (req, res) => {
    const scope = req.query.scope === "project" ? "project" : "personal";
    const briefing = getTodayBriefingRecord({ scope });
    res.json({ ok: true, data: { briefing } });
  });

  app.post("/personal/briefing/generate", requireScope("write"), async (req, res) => {
    try {
      const scope = req.body?.scope === "project" ? "project" : "personal";
      const projectId = req.body?.projectId || req.projectId || null;
      const briefing = await generateDailyBriefing({ scope, projectId, persist: true });
      res.status(201).json({ ok: true, data: briefing });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: { code: "briefing_generate_failed", message: err.message },
      });
    }
  });

  app.get("/personal/memory", requireScope("read"), (req, res) => {
    const prefs = listPersonalMemory({
      scope: req.query.scope || null,
      projectId: req.query.projectId || req.projectId || null,
    });
    res.json({ ok: true, data: { preferences: prefs, count: prefs.length } });
  });

  app.post("/personal/memory/remember", requireScope("write"), (req, res) => {
    try {
      const { key, value, scope, projectId, pinned } = req.body || {};
      const pref = rememberPersonal({
        key,
        value: String(value ?? ""),
        scope: scope || "global",
        projectId: projectId || null,
        pinned: !!pinned,
      });
      res.status(201).json({ ok: true, data: pref });
    } catch (err) {
      res.status(err.code === "invalid" ? 400 : 500).json({
        ok: false,
        error: { code: err.code || "remember_failed", message: err.message },
      });
    }
  });

  app.post("/personal/memory/forget", requireScope("write"), (req, res) => {
    const id = req.body?.id;
    if (!id) {
      return res.status(400).json({ ok: false, error: { code: "invalid", message: "id required" } });
    }
    const ok = forgetPersonal(id);
    res.json({ ok: true, data: { deleted: ok, id } });
  });

  app.post("/personal/memory/pin", requireScope("write"), (req, res) => {
    const id = req.body?.id;
    if (!id) {
      return res.status(400).json({ ok: false, error: { code: "invalid", message: "id required" } });
    }
    const pref = pinPersonal(id, req.body?.pinned !== false);
    if (!pref) {
      return res.status(404).json({ ok: false, error: { code: "not_found" } });
    }
    res.json({ ok: true, data: pref });
  });

  app.get("/personal/memory/export", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: exportPersonalMemory() });
  });

  app.get("/personal/hub-pause", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: getHubPauseState() });
  });

  app.get("/personal/desktop/status", requireScope("read"), async (_req, res) => {
    try {
      const data = await getPersonalDesktopStatus();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "desktop_status_failed", message: err.message } });
    }
  });

  app.get("/personal/desktop/allowlist", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: getDesktopAllowlist() });
  });

  app.put("/personal/desktop/allowlist", requireScope("write"), (req, res) => {
    try {
      const data = updateDesktopAllowlist(req.body || {});
      res.json({ ok: true, data });
    } catch (err) {
      res.status(err.code === "invalid" ? 400 : 500).json({
        ok: false,
        error: { code: err.code || "allowlist_update_failed", message: err.message },
      });
    }
  });

  app.get("/personal/desktop/preview", requireScope("read"), async (_req, res) => {
    try {
      const data = await capturePersonalDesktopPreview();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "desktop_preview_failed", message: err.message } });
    }
  });

  app.get("/personal/sidecar/file", requireScope("read"), async (req, res) => {
    const path = req.query.path;
    if (!path) {
      return res.status(400).json({ ok: false, error: { code: "invalid", message: "path required" } });
    }
    const result = await readPersonalSidecarFile(String(path));
    if (!result?.ok) {
      return res.status(502).json({ ok: false, error: result?.error || { message: "read failed" } });
    }
    res.json({ ok: true, data: result.data });
  });

  app.get("/personal/sidecar/list", requireScope("read"), async (req, res) => {
    const path = req.query.path || ".";
    const result = await listPersonalSidecarDir(String(path));
    if (!result?.ok) {
      return res.status(502).json({ ok: false, error: result?.error || { message: "list failed" } });
    }
    res.json({ ok: true, data: result.data });
  });

  app.get("/personal/autonomy", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: getPersonalAutonomyState() });
  });

  app.put("/personal/autonomy/preset", requireScope("write"), (req, res) => {
    try {
      const presetId = req.body?.presetId;
      if (!presetId || !PERSONAL_PRESETS[presetId]) {
        return res.status(400).json({ ok: false, error: { code: "invalid", message: "presetId required" } });
      }
      const data = setPersonalAutonomyPreset(presetId);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(err.code === "invalid" ? 400 : 500).json({
        ok: false,
        error: { code: err.code || "preset_failed", message: err.message },
      });
    }
  });

  app.get("/personal/ops", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: getOpsDashboard() });
  });

  app.put("/personal/ops/limits", requireScope("write"), (req, res) => {
    const data = updateOpsLimits(req.body || {});
    res.json({ ok: true, data });
  });

  app.post("/personal/ops/emergency-stop", requireScope("write"), (req, res) => {
    const minutes = Number(req.body?.minutes) || 60;
    const data = triggerEmergencyStop({ minutes, reason: req.body?.reason || "api_emergency_stop" });
    res.json({ ok: true, data });
  });

  app.post("/personal/ops/emergency-resume", requireScope("write"), (_req, res) => {
    const data = clearEmergencyStop();
    res.json({ ok: true, data });
  });
}
