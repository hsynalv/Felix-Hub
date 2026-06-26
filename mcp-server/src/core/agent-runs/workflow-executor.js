/**
 * Workflow phase execution — retries, checkpoints, compensation.
 */

import { callTool } from "../tool-registry.js";
import {
  getRun,
  updateRunStatus,
  createCheckpoint,
  updateRunCurrentStep,
  listRunSteps,
  RunStatus,
} from "./agent-runs.service.js";
import { recordToolStep, completeRun } from "./run-orchestrator.js";
import { emitRunEvent } from "./run-events.js";
import { expandWorkflowSteps } from "./workflow-expr.js";
import { resolveTemplateForExecution } from "./workflow-template-store.js";
import { enforceWorkflowStepSla } from "./workflow-sla-gate.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_STEP_TIMEOUT_MS = Number(process.env.WORKFLOW_STEP_TIMEOUT_MS) || 60_000;

function withTimeout(promise, timeoutMs, label) {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Step timeout after ${timeoutMs}ms: ${label}`)), timeoutMs);
    }),
  ]);
}

async function executeToolPhase(runId, phase, { dryRun, context, onLog }) {
  const maxRetries = phase.maxRetries ?? 0;
  const backoffMs = phase.backoffMs ?? 500;
  const timeoutMs = phase.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
  let lastResult;
  let attempt = 0;

  while (attempt <= maxRetries) {
    const toolStart = Date.now();
    if (dryRun) {
      lastResult = {
        ok: true,
        data: { dryRun: true, tool: phase.toolName, args: phase.args, simulated: true, attempt },
      };
    } else {
      lastResult = await withTimeout(
        callTool(phase.toolName, phase.args, {
          ...context,
          runId,
          dryRun: false,
        }),
        timeoutMs,
        phase.toolName
      );
    }

    await recordToolStep(runId, {
      toolName: phase.toolName,
      input: phase.args,
      output: lastResult,
      durationMs: Date.now() - toolStart,
      phase: "end",
      retryCount: attempt,
    });
    emitRunEvent(runId, { type: "tool", phase: "end", name: phase.toolName, result: lastResult, attempt });

    if (lastResult?.ok !== false || dryRun) {
      return lastResult;
    }

    attempt += 1;
    if (attempt <= maxRetries) {
      await onLog?.(`Retry ${attempt}/${maxRetries} for ${phase.toolName}`);
      await sleep(backoffMs * attempt);
    }
  }

  return lastResult;
}

export async function runCompensations(runId, completedPhases, { dryRun, context, onLog }) {
  for (const phase of [...completedPhases].reverse()) {
    if (!phase.compensate?.toolName) continue;
    await onLog?.(`Compensating: ${phase.compensate.toolName}`);
    const args = phase.compensate.args || {};
    if (dryRun) {
      await recordToolStep(runId, {
        toolName: phase.compensate.toolName,
        input: args,
        output: { ok: true, data: { dryRun: true, compensate: true } },
        durationMs: 0,
        phase: "compensate",
      });
      continue;
    }
    const toolStart = Date.now();
    const result = await callTool(phase.compensate.toolName, args, { ...context, runId });
    await recordToolStep(runId, {
      toolName: phase.compensate.toolName,
      input: args,
      output: result,
      durationMs: Date.now() - toolStart,
      phase: "compensate",
    });
  }
}

/**
 * Execute workflow phases for a run.
 */
export async function executeWorkflowRun({
  runId,
  template,
  params = {},
  dryRun = false,
  context = {},
  startFromStep = 0,
  singleStep = false,
  updateProgress = async () => {},
  log = async () => {},
}) {
  const phases = expandWorkflowSteps(template.steps, params).map((p, index) => ({
    ...p,
    index,
    toolName: p.toolName,
    args: p.args || {},
  }));

  if (!phases.length) {
    throw new Error("Workflow has no executable phases");
  }

  await updateRunStatus(runId, RunStatus.RUNNING);
  await log(`Workflow ${template.id} started (${phases.length} phases, from step ${startFromStep})`);

  const completedPhases = [];
  const endIndex = singleStep ? Math.min(startFromStep + 1, phases.length) : phases.length;

  for (let i = startFromStep; i < endIndex; i++) {
    const phase = phases[i];
    await updateProgress(Math.round(((i + 1) / phases.length) * 90));

    if (phase.type === "approval") {
      await createCheckpoint(runId, {
        type: "approval",
        payload: { stepIndex: i, name: phase.name || `approval-${i}` },
      });
      await updateRunCurrentStep(runId, i);
      await updateRunStatus(runId, RunStatus.WAITING_APPROVAL);
      await log(`Approval checkpoint: ${phase.name || i}`);
      emitRunEvent(runId, { type: "status", status: RunStatus.WAITING_APPROVAL, checkpoint: i });
      return { paused: true, stepIndex: i, awaitingApproval: true, phases: phases.length };
    }

    if (phase.type === "checkpoint") {
      await createCheckpoint(runId, {
        type: "workflow",
        payload: { stepIndex: i, name: phase.name || `step-${i}` },
      });
      await updateRunCurrentStep(runId, i);
      await updateRunStatus(runId, RunStatus.PAUSED);
      await log(`Checkpoint: ${phase.name || i} — run paused for resume`);
      emitRunEvent(runId, { type: "status", status: RunStatus.PAUSED, checkpoint: i });
      return { paused: true, stepIndex: i, phases: phases.length };
    }

    if (phase.type !== "tool" || !phase.toolName) {
      await log(`Skipping non-tool phase at index ${i}`);
      continue;
    }

    await log(`Step ${i + 1}/${phases.length}: ${phase.toolName}`);

    const result = await executeToolPhase(runId, phase, { dryRun, context, onLog: log });

    if (!dryRun) {
      const slaGate = await enforceWorkflowStepSla({
        ...context,
        runId,
        estimatedCostUsd: result?.usage?.estimatedCostUsd || result?.data?.usage?.estimatedCostUsd || 0,
      });
      if (!slaGate.ok) {
        await runCompensations(runId, completedPhases, { dryRun, context, onLog: log });
        await completeRun(runId, { error: { message: slaGate.message, code: slaGate.code } });
        emitRunEvent(runId, { type: "status", status: RunStatus.FAILED, sla: slaGate.code });
        throw new Error(slaGate.message || "SLA gate blocked workflow step");
      }
    }

    if (result?.ok === false && !dryRun) {
      await runCompensations(runId, completedPhases, { dryRun, context, onLog: log });
      await completeRun(runId, { error: { message: `Step failed: ${phase.toolName}`, step: i } });
      emitRunEvent(runId, { type: "status", status: RunStatus.FAILED });
      throw new Error(`Workflow step failed: ${phase.toolName}`);
    }

    completedPhases.push(phase);
  }

  if (singleStep) {
    await updateRunCurrentStep(runId, Math.min(startFromStep, phases.length - 1));
    emitRunEvent(runId, { type: "status", status: RunStatus.RUNNING, singleStep: true });
    await log(`Single step ${startFromStep + 1} completed`);
    return { templateId: template.id, steps: phases.length, singleStep: true, stepIndex: startFromStep };
  }

  await completeRun(runId);
  emitRunEvent(runId, { type: "status", status: RunStatus.COMPLETED });
  await updateProgress(100);
  await log("Workflow completed");
  return { templateId: template.id, steps: phases.length, completed: true };
}

export async function resumeWorkflowRun({
  runId,
  templateId,
  params,
  dryRun,
  context,
  startFromStep,
  updateProgress,
  log,
}) {
  const run = await getRun(runId);
  if (!run) throw new Error("Run not found");
  const template = resolveTemplateForExecution(templateId);
  if (!template) throw new Error(`Unknown template: ${templateId}`);

  return executeWorkflowRun({
    runId,
    template,
    params: params || run.metadata?.parameters || {},
    dryRun: dryRun ?? run.metadata?.dryRun ?? false,
    context,
    startFromStep: startFromStep ?? run.currentStep ?? 0,
    singleStep: false,
    updateProgress,
    log,
  });
}

export function phasesFromRunSteps(template, params, steps) {
  if (!template?.steps) return [];
  const expanded = expandWorkflowSteps(template.steps, params);
  const completed = [];
  for (const step of steps) {
    if (step.type !== "tool" || step.status !== "ok" || !step.toolName) continue;
    const phase = expanded.find((p) => p.toolName === step.toolName);
    if (phase) completed.push(phase);
  }
  return completed;
}

export async function rollbackWorkflowRun({ runId, template, dryRun = true, context = {}, onLog }) {
  const run = await getRun(runId);
  if (!run) throw new Error("Run not found");
  const steps = await listRunSteps(runId, { limit: 500 });
  const params = run.metadata?.parameters || {};
  const completedPhases = template ? phasesFromRunSteps(template, params, steps) : [];
  await runCompensations(runId, completedPhases, {
    dryRun,
    context,
    onLog: onLog || (async () => {}),
  });
  return { runId, compensated: completedPhases.length, dryRun };
}

export { runCompensations as exportRunCompensations };
