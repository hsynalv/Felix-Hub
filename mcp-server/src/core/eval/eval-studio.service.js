/**
 * Eval Studio — golden trace management, workflow regression, quality reports.
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getWorkflowTemplate,
  buildPlanFromTemplate,
} from "../agent-runs/workflow-templates.js";
import { compareTrace, stepsFromWorkflowPlan } from "../../../eval/runners/trace-compare.js";
import { compareRuns, compareRunWithReplay } from "../agent-runs/run-control.js";
import { listRunSteps } from "../agent-runs/agent-runs.service.js";
import { queryRunUsage } from "../usage/usage-ledger.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIRS = [
  join(__dirname, "../../../eval/golden"),
  join(__dirname, "../../../tests/fixtures/runs"),
];

function loadGoldenFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function listGoldenTraces() {
  const seen = new Set();
  const traces = [];

  for (const dir of GOLDEN_DIRS) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
      const id = file.replace(/\.json$/, "");
      if (seen.has(id)) continue;
      seen.add(id);
      const data = loadGoldenFile(join(dir, file));
      traces.push({
        id: data.id || id,
        file,
        templateId: data.templateId,
        goal: data.goal || null,
        stepCount: (data.expectedSteps || data.steps || []).length,
        parameters: data.parameters || {},
      });
    }
  }
  return traces;
}

export function getGoldenTrace(traceId) {
  for (const dir of GOLDEN_DIRS) {
    const candidates = [`${traceId}.json`, traceId.endsWith(".json") ? traceId : null].filter(Boolean);
    for (const file of candidates) {
      const path = join(dir, file);
      if (existsSync(path)) return loadGoldenFile(path);
    }
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const data = loadGoldenFile(join(dir, file));
      if (data.id === traceId || file.replace(/\.json$/, "") === traceId) return data;
    }
  }
  return null;
}

/** Run golden trace regression for a single template fixture. */
export function evalTemplateRegression({ templateId, parameters, golden, tolerances = {} }) {
  const template = getWorkflowTemplate(templateId);
  if (!template) {
    return { pass: false, error: { code: "template_not_found", message: `Unknown template: ${templateId}` } };
  }

  const plan = buildPlanFromTemplate(template, parameters);
  const syntheticSteps = stepsFromWorkflowPlan(plan);
  const fixture = golden || { expectedSteps: [], templateId, parameters };
  const comparison = compareTrace(fixture, syntheticSteps, {
    orderStrict: tolerances.orderStrict ?? fixture.orderStrict ?? true,
    extraSteps: tolerances.extraSteps ?? fixture.extraSteps ?? 0,
  });

  return {
    pass: comparison.pass,
    templateId,
    plan: {
      phaseCount: plan.phases.length,
      tools: plan.phases.filter((p) => p.type === "tool").map((p) => p.toolName),
    },
    comparison,
  };
}

/** Run all golden fixtures and return aggregate report. */
export function runRegressionSuite() {
  const traces = listGoldenTraces();
  const results = [];
  let passed = 0;
  let failed = 0;

  for (const trace of traces) {
    if (!trace.templateId) continue;
    const golden = getGoldenTrace(trace.id);
    if (!golden?.expectedSteps && !golden?.steps) continue;

    const result = evalTemplateRegression({
      templateId: trace.templateId,
      parameters: trace.parameters || golden.parameters || {},
      golden,
    });
    if (result.pass) passed++;
    else failed++;
    results.push({
      id: trace.id,
      templateId: trace.templateId,
      pass: result.pass,
      diffs: result.comparison?.diffs || [],
    });
  }

  return {
    pass: failed === 0,
    summary: { total: results.length, passed, failed },
    results,
    generatedAt: new Date().toISOString(),
  };
}

/** Compare an actual run's steps against its golden fixture (by templateId). */
export async function evalRunAgainstGolden(runId, { goldenId, templateId } = {}) {
  const steps = await listRunSteps(runId, { limit: 500 });
  const actualSteps = steps.map((s) => ({
    type: s.type,
    toolName: s.toolName,
    input: s.input,
    output: s.output,
  }));

  let golden = goldenId ? getGoldenTrace(goldenId) : null;
  if (!golden && templateId) {
    golden = getGoldenTrace(templateId) || listGoldenTraces().find((t) => t.templateId === templateId);
    if (golden && !golden.expectedSteps) golden = getGoldenTrace(golden.id);
  }

  if (!golden) {
    return { pass: false, error: { code: "no_golden", message: "No golden trace found" } };
  }

  const comparison = compareTrace(golden, actualSteps, {
    orderStrict: golden.orderStrict ?? true,
    extraSteps: golden.extraSteps ?? 2,
  });

  let usage = null;
  try {
    usage = await queryRunUsage(runId);
  } catch {
    usage = null;
  }

  return {
    pass: comparison.pass,
    runId,
    goldenId: golden.id || golden.templateId,
    comparison,
    usage: usage?.totals || null,
    stepCount: actualSteps.length,
  };
}

/** Workflow template change impact — compare tool sequences between two plans. */
export function compareWorkflowPlans(baselinePlan, candidatePlan) {
  const baselineSteps = stepsFromWorkflowPlan(baselinePlan);
  const candidateSteps = stepsFromWorkflowPlan(candidatePlan);
  const comparison = compareTrace(
    { expectedSteps: baselineSteps },
    candidateSteps,
    { orderStrict: true, extraSteps: 0 }
  );

  return {
    pass: comparison.pass,
    behaviorChanged: !comparison.pass,
    comparison,
    summary: comparison.pass
      ? "No tool-sequence regression detected"
      : `${comparison.diffs.length} difference(s) in tool order or selection`,
  };
}

/** Replay compare wrapper for eval API. */
export async function evalReplayCompare(runId, { dryRun = true } = {}) {
  const result = await compareRunWithReplay(runId, { dryRun, createdBy: "eval-studio" });
  if (!result) return { pass: false, error: { code: "run_not_found", message: "Run not found" } };

  const { comparison, replayRunId } = result;
  const pass = comparison?.match !== false && (comparison?.diffs?.length ?? 0) === 0;

  return {
    pass,
    runId,
    replayRunId,
    comparison,
  };
}

export async function evalTwoRuns(sourceRunId, targetRunId) {
  const comparison = await compareRuns(sourceRunId, targetRunId);
  const pass = (comparison?.diffs?.length ?? 0) === 0;
  return { pass, comparison };
}
