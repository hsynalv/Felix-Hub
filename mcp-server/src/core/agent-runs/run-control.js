/**
 * Run control operations — pause, retry-step, rollback, compare.
 */

import {
  getRun,
  listRunSteps,
  updateRunStatus,
  RunStatus,
  StepType,
} from "./agent-runs.service.js";
import { assertRunStatusTransition } from "./run-state-machine.js";
import { pauseRunJob } from "./agent-run-job.js";
import { submitJob } from "../jobs.js";
import { linkRunToJob } from "./agent-run-job.js";
import { WORKFLOW_RUN_JOB_TYPE } from "./workflow-run-job.js";
import {
  executeWorkflowRun,
  rollbackWorkflowRun,
  exportRunCompensations,
} from "./workflow-executor.js";
import { resolveTemplateForExecution } from "./workflow-template-store.js";
import { replayRun } from "./run-orchestrator.js";
import { emitRunEvent } from "./run-events.js";

export async function transitionRunStatus(runId, to, opts = {}) {
  const run = await getRun(runId);
  if (!run) return null;
  assertRunStatusTransition(run.status, to);
  return updateRunStatus(runId, to, opts);
}

export async function pauseRun(runId) {
  const run = await getRun(runId);
  if (!run) return null;
  assertRunStatusTransition(run.status, RunStatus.PAUSED);
  await pauseRunJob(runId);
  const updated = await updateRunStatus(runId, RunStatus.PAUSED);
  emitRunEvent(runId, { type: "status", status: RunStatus.PAUSED, reason: "user_pause" });
  return updated;
}

export async function retryRunStep(runId, { stepIndex, context = {} } = {}) {
  const run = await getRun(runId);
  if (!run) return null;

  const templateId = run.metadata?.templateId;
  if (!templateId) {
    const err = new Error("Run has no workflow template — retry-step requires templateId in metadata");
    err.code = "not_workflow_run";
    throw err;
  }

  const template = resolveTemplateForExecution(templateId);
  if (!template) {
    const err = new Error(`Unknown template: ${templateId}`);
    err.code = "template_not_found";
    throw err;
  }

  const idx = Number.isFinite(stepIndex) ? stepIndex : Number(run.currentStep ?? 0);
  if (idx < 0) {
    const err = new Error("Invalid stepIndex");
    err.code = "invalid_step";
    throw err;
  }

  if (run.status === RunStatus.FAILED || run.status === RunStatus.PAUSED) {
    await transitionRunStatus(runId, RunStatus.RUNNING);
  } else if (run.status !== RunStatus.RUNNING) {
    await transitionRunStatus(runId, RunStatus.RUNNING);
  }

  const dryRun = run.metadata?.dryRun ?? false;
  const job = submitJob(
    WORKFLOW_RUN_JOB_TYPE,
    {
      runId,
      templateId,
      params: run.metadata?.parameters || {},
      dryRun,
      startFromStep: idx,
      singleStep: true,
      context,
    },
    { projectId: run.projectId, user: context.user }
  );
  linkRunToJob(runId, job.id);
  return { run: await getRun(runId), jobId: job.id, stepIndex: idx };
}

export async function rollbackRun(runId, { context = {}, dryRun = true } = {}) {
  const run = await getRun(runId);
  if (!run) return null;

  if (![RunStatus.FAILED, RunStatus.CANCELLED, RunStatus.RUNNING, RunStatus.PAUSED].includes(run.status)) {
    const err = new Error(`Cannot rollback run in status ${run.status}`);
    err.code = "invalid_state";
    throw err;
  }

  const templateId = run.metadata?.templateId;
  const template = templateId ? resolveTemplateForExecution(templateId) : null;
  const result = await rollbackWorkflowRun({
    runId,
    template,
    dryRun: dryRun ?? run.metadata?.dryRun ?? true,
    context,
  });

  await transitionRunStatus(runId, RunStatus.CANCELLED, {
    error: { code: "rolled_back", message: "Compensation chain executed" },
  });

  return result;
}

function summarizeStep(step) {
  return {
    stepIndex: step.stepIndex,
    type: step.type,
    toolName: step.toolName,
    status: step.status,
    outputHash: JSON.stringify(step.output ?? null),
  };
}

/**
 * Compare two runs' step traces (structural diff).
 */
export async function compareRuns(sourceRunId, targetRunId) {
  const source = await getRun(sourceRunId);
  const target = await getRun(targetRunId);
  if (!source || !target) return null;

  const sourceSteps = await listRunSteps(sourceRunId, { limit: 500 });
  const targetSteps = await listRunSteps(targetRunId, { limit: 500 });

  const maxLen = Math.max(sourceSteps.length, targetSteps.length);
  const diffs = [];

  for (let i = 0; i < maxLen; i++) {
    const a = sourceSteps[i];
    const b = targetSteps[i];
    if (!a || !b) {
      diffs.push({ stepIndex: i, kind: a ? "missing_target" : "missing_source" });
      continue;
    }
    const sa = summarizeStep(a);
    const sb = summarizeStep(b);
    if (
      sa.type !== sb.type ||
      sa.toolName !== sb.toolName ||
      sa.status !== sb.status ||
      sa.outputHash !== sb.outputHash
    ) {
      diffs.push({
        stepIndex: i,
        kind: "changed",
        source: sa,
        target: sb,
      });
    }
  }

  return {
    sourceRunId,
    targetRunId,
    sourceStepCount: sourceSteps.length,
    targetStepCount: targetSteps.length,
    identical: diffs.length === 0,
    diffs,
  };
}

export async function compareRunWithReplay(sourceRunId, { dryRun = true, createdBy = "compare" } = {}) {
  const replayed = await replayRun(sourceRunId, { dryRun, createdBy });
  if (!replayed) return null;
  const comparison = await compareRuns(sourceRunId, replayed.id);
  return { replayRunId: replayed.id, comparison };
}

export { exportRunCompensations };
