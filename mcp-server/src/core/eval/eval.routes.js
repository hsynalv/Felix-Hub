/**
 * Eval Studio HTTP routes.
 */

import { requireScope } from "../auth.js";
import {
  listGoldenTraces,
  getGoldenTrace,
  evalTemplateRegression,
  runRegressionSuite,
  evalGoldenTraceById,
  resolveGoldenForEval,
  evalRunAgainstGolden,
  compareWorkflowPlans,
  evalReplayCompare,
  evalTwoRuns,
} from "./eval-studio.service.js";
import { getWorkflowTemplate, buildPlanFromTemplate } from "../agent-runs/workflow-templates.js";

export function registerEvalRoutes(app) {
  app.get("/eval/golden", requireScope("read"), (_req, res) => {
    try {
      const traces = listGoldenTraces();
      res.json({ ok: true, data: { traces, count: traces.length } });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "golden_list_failed", message: err.message } });
    }
  });

  app.get("/eval/golden/:id", requireScope("read"), (req, res) => {
    const golden = getGoldenTrace(req.params.id);
    if (!golden) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Golden trace not found" } });
    }
    res.json({ ok: true, data: golden });
  });

  app.post("/eval/golden/:id/eval", requireScope("read"), (req, res) => {
    try {
      const result = evalGoldenTraceById(req.params.id, { parameters: req.body?.parameters || {} });
      if (result.error?.code === "not_found") {
        return res.status(404).json({ ok: false, error: result.error });
      }
      res.json({ ok: true, data: { ...result, goldenId: req.params.id } });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "golden_eval_failed", message: err.message } });
    }
  });

  app.post("/eval/regression", requireScope("read"), (_req, res) => {
    try {
      const report = runRegressionSuite();
      res.json({ ok: true, data: report });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "regression_failed", message: err.message } });
    }
  });

  app.post("/eval/template/:templateId", requireScope("read"), (req, res) => {
    try {
      const templateId = req.params.templateId;
      const parameters = req.body?.parameters || {};
      const golden =
        resolveGoldenForEval({ goldenId: req.body?.goldenId, templateId }) ||
        (req.body?.goldenId ? getGoldenTrace(req.body.goldenId) : null);
      const result = evalTemplateRegression({ templateId, parameters, golden });
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "template_eval_failed", message: err.message } });
    }
  });

  app.post("/eval/runs/:id", requireScope("read"), async (req, res) => {
    try {
      const data = await evalRunAgainstGolden(req.params.id, { goldenId: req.body?.goldenId });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "run_eval_failed", message: err.message } });
    }
  });

  app.post("/eval/runs/:id/replay-compare", requireScope("read"), async (req, res) => {
    try {
      const data = await evalReplayCompare(req.params.id, { dryRun: req.body?.dryRun !== false });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "replay_compare_failed", message: err.message } });
    }
  });

  app.post("/eval/compare-runs", requireScope("read"), async (req, res) => {
    try {
      const { sourceRunId, targetRunId } = req.body ?? {};
      if (!sourceRunId || !targetRunId) {
        return res.status(400).json({
          ok: false,
          error: { code: "invalid_request", message: "sourceRunId and targetRunId required" },
        });
      }
      const data = await evalTwoRuns(sourceRunId, targetRunId);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "compare_failed", message: err.message } });
    }
  });

  app.post("/eval/workflow-diff", requireScope("read"), (req, res) => {
    try {
      const { templateId, parameters = {}, candidateSteps } = req.body ?? {};
      const template = getWorkflowTemplate(templateId);
      if (!template) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Template not found" } });
      }
      const baselinePlan = buildPlanFromTemplate(template, parameters);
      const candidatePlan = candidateSteps
        ? { phases: candidateSteps }
        : buildPlanFromTemplate({ ...template, steps: req.body?.modifiedSteps || template.steps }, parameters);
      const data = compareWorkflowPlans(baselinePlan, candidatePlan);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "workflow_diff_failed", message: err.message } });
    }
  });
}
