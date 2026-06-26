/**
 * V5 Faz B engineering agent routes — release, maintenance, hygiene.
 */

import { requireScope } from "../auth.js";
import { analyzeRelease, createDraftGitHubRelease } from "./release-manager.service.js";
import { scanDependencies, proposeMaintenancePr } from "./maintenance.service.js";
import { runHygieneScan } from "./hygiene.service.js";
import { listAgentPresets } from "./agent-presets.js";
import { executeRunbook } from "../ops/runbook.service.js";
import { assertRunbookForceAllowed } from "../ops/runbook-force-guard.js";
import { createSchedule } from "../ops/schedule.service.js";

import { triageIncident, triggerIncidentRunbook } from "./incident-triage.service.js";

function runbookExecuteFromRequest(req, body, defaults = {}) {
  const requestedForce = body?.force === true;
  if (requestedForce) {
    assertRunbookForceAllowed({ requested: true, authScopes: req.authScopes || [] });
  }
  return {
    parameters: body?.parameters || {},
    projectId: req.projectId,
    createdBy: req.actor?.type || "api",
    dryRun: body?.dryRun === true,
    force: requestedForce,
    ...defaults,
  };
}

export function registerAgentRoutes(app) {
  app.get("/agents/presets", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: listAgentPresets() });
  });

  app.post("/agents/schedules/from-preset/:presetId", requireScope("write"), (req, res) => {
    try {
      const presets = listAgentPresets().schedules;
      const preset = presets.find((p) => p.id === req.params.presetId);
      if (!preset) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Preset not found" } });
      }
      if (preset.manual || !preset.cronExpr) {
        return res.status(400).json({ ok: false, error: { code: "manual_preset", message: "Preset is manual-only" } });
      }
      const schedule = createSchedule({
        name: preset.name,
        runbookId: preset.runbookId || null,
        templateId: preset.templateId || null,
        reportType: preset.reportType || null,
        cronExpr: preset.cronExpr,
        timezone: preset.timezone || "UTC",
        maxCostUsd: preset.maxCostUsd,
        autonomyLevel: preset.autonomyLevel,
        skipIf: preset.skipIf,
        notifyTarget: preset.notifyTarget,
        parameters: { ...preset.parameters, ...req.body?.parameters },
        projectId: req.body?.projectId || req.projectId,
        projectEnv: req.body?.projectEnv || req.projectEnv || "staging",
      });
      res.status(201).json({ ok: true, data: schedule });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "preset_failed", message: err.message } });
    }
  });

  // --- Release Manager ---
  app.post("/agents/release/analyze", requireScope("read"), async (req, res) => {
    try {
      const { repo, sinceTag, changelogFormat, prs } = req.body ?? {};
      if (!repo) {
        return res.status(400).json({ ok: false, error: { code: "invalid", message: "repo required" } });
      }
      const data = await analyzeRelease({ repo, sinceTag, changelogFormat, prs });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "analyze_failed", message: err.message } });
    }
  });

  app.post("/agents/release/draft", requireScope("write"), async (req, res) => {
    try {
      const { repo, tagName, name, body, targetCommitish, changelog, analyze } = req.body ?? {};
      if (!repo || !tagName) {
        return res.status(400).json({ ok: false, error: { code: "invalid", message: "repo and tagName required" } });
      }
      const releaseBody = body || changelog || analyze?.changelog || "";
      const data = await createDraftGitHubRelease({
        repo,
        tagName,
        name,
        body: releaseBody,
        targetCommitish,
        draft: true,
      });
      if (!data.ok) {
        return res.status(502).json({ ok: false, error: { code: "github_error", message: data.error, details: data.details } });
      }
      res.status(201).json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "draft_failed", message: err.message } });
    }
  });

  app.post("/agents/release/run", requireScope("write"), async (req, res) => {
    try {
      const data = await executeRunbook(
        "rb-release-manager",
        runbookExecuteFromRequest(req, req.body ?? {}, { projectEnv: req.projectEnv || "staging" })
      );
      res.status(data.started ? 201 : 200).json({ ok: true, data });
    } catch (err) {
      const status = err.code === "force_forbidden" ? 403 : 400;
      res.status(status).json({ ok: false, error: { code: err.code || "run_failed", message: err.message } });
    }
  });

  // --- Maintenance ---
  app.post("/agents/maintenance/scan", requireScope("read"), async (req, res) => {
    try {
      const { workspacePath, ecosystem, maxRiskScore } = req.body ?? {};
      const data = await scanDependencies({ workspacePath, ecosystem, maxRiskScore });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "scan_failed", message: err.message } });
    }
  });

  app.post("/agents/maintenance/propose-pr", requireScope("read"), async (req, res) => {
    try {
      const scan = req.body?.scan || (await scanDependencies(req.body || {}));
      const proposal = proposeMaintenancePr(scan, { repo: req.body?.repo, branch: req.body?.branch });
      res.json({ ok: true, data: { scan, proposal } });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "propose_failed", message: err.message } });
    }
  });

  app.post("/agents/maintenance/run", requireScope("write"), async (req, res) => {
    try {
      const data = await executeRunbook(
        "rb-maintenance",
        runbookExecuteFromRequest(req, req.body ?? {}, { projectEnv: req.projectEnv || "staging" })
      );
      res.status(data.started ? 201 : 200).json({ ok: true, data });
    } catch (err) {
      const status = err.code === "force_forbidden" ? 403 : 400;
      res.status(status).json({ ok: false, error: { code: err.code || "run_failed", message: err.message } });
    }
  });

  // --- Hygiene ---
  app.post("/agents/hygiene/scan", requireScope("read"), async (req, res) => {
    try {
      const { repo, workspacePath, stalePrDays, archiveRunDays, branches } = req.body ?? {};
      if (!repo) {
        return res.status(400).json({ ok: false, error: { code: "invalid", message: "repo required" } });
      }
      const data = await runHygieneScan({
        repo,
        projectId: req.projectId,
        workspacePath,
        stalePrDays,
        archiveRunDays,
        branches,
      });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "scan_failed", message: err.message } });
    }
  });

  app.post("/agents/hygiene/run", requireScope("write"), async (req, res) => {
    try {
      const data = await executeRunbook(
        "rb-hygiene",
        runbookExecuteFromRequest(req, req.body ?? {}, { projectEnv: req.projectEnv || "development" })
      );
      res.status(data.started ? 201 : 200).json({ ok: true, data });
    } catch (err) {
      const status = err.code === "force_forbidden" ? 403 : 400;
      res.status(status).json({ ok: false, error: { code: err.code || "run_failed", message: err.message } });
    }
  });

  // --- Incident Triage ---
  app.post("/agents/incident/triage", requireScope("read"), async (req, res) => {
    try {
      const { repo, errorSignal, owner } = req.body ?? {};
      if (!repo) {
        return res.status(400).json({ ok: false, error: { code: "invalid", message: "repo required" } });
      }
      const data = await triageIncident({
        repo,
        projectId: req.projectId,
        errorSignal,
        owner,
      });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "triage_failed", message: err.message } });
    }
  });

  app.post("/agents/incident/run", requireScope("write"), async (req, res) => {
    try {
      const data = await triggerIncidentRunbook({
        repo: req.body?.repo,
        projectId: req.projectId,
        projectEnv: req.projectEnv || "production",
        dryRun: req.body?.dryRun === true,
        forceInternal: false,
      });
      res.status(data.started ? 201 : 200).json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: err.code || "run_failed", message: err.message } });
    }
  });
}
