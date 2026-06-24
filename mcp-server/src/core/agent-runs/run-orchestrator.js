/**
 * Agent run orchestrator — bridges chat/tool loop with run persistence.
 */

import {
  createRun,
  findActiveRunForConversation,
  updateRunStatus,
  appendRunStep,
  createCheckpoint,
  getRun,
  listRunSteps,
  RunStatus,
  StepType,
} from "./agent-runs.service.js";
import {
  getWorkflowTemplate,
  buildPlanFromTemplate,
  listWorkflowTemplates,
} from "./workflow-templates.js";

/**
 * Get or create an active run for a chat turn.
 */
export async function ensureRunForChat({
  conversationId,
  goal,
  projectId,
  createdBy,
  metadata = null,
}) {
  if (conversationId) {
    const existing = await findActiveRunForConversation(conversationId);
    if (existing) {
      if (goal && !existing.goal) {
        await updateRunStatus(existing.id, RunStatus.RUNNING);
      }
      return existing;
    }
  }

  return createRun({
    goal: goal || "Chat turn",
    conversationId: conversationId || null,
    projectId: projectId || null,
    createdBy: createdBy || "anonymous",
    metadata,
  });
}

export async function recordLlmStep(runId, { model, provider, usage, durationMs, iteration }) {
  if (!runId) return null;
  return appendRunStep(runId, {
    type: StepType.LLM,
    status: "ok",
    durationMs,
    usage,
    metadata: { model, provider, iteration },
  });
}

export async function recordToolStep(runId, { toolName, input, output, durationMs, phase }) {
  if (!runId) return null;
  const failed = output && typeof output === "object" && output.ok === false;
  return appendRunStep(runId, {
    type: StepType.TOOL,
    toolName,
    input,
    output,
    status: failed ? "error" : "ok",
    durationMs,
    metadata: { phase },
  });
}

export async function recordApprovalPending(runId, { approvalId, toolName, args }) {
  if (!runId) return null;
  await updateRunStatus(runId, RunStatus.WAITING_APPROVAL);
  const step = await appendRunStep(runId, {
    type: StepType.APPROVAL,
    toolName,
    input: args,
    status: "pending",
    metadata: { approvalId },
  });
  await createCheckpoint(runId, {
    stepId: step?.id,
    approvalId,
    type: "approval",
    payload: { toolName, approvalId },
  });
  return step;
}

export async function recordApprovalResolved(runId, { approvalId, approved, toolName }) {
  if (!runId) return null;
  await appendRunStep(runId, {
    type: StepType.APPROVAL,
    toolName,
    status: approved ? "ok" : "error",
    metadata: { approvalId, decision: approved ? "approved" : "rejected" },
  });
  if (approved) {
    await updateRunStatus(runId, RunStatus.RUNNING);
  } else {
    await updateRunStatus(runId, RunStatus.CANCELLED, {
      error: { code: "approval_rejected", message: `Approval ${approvalId} rejected` },
    });
  }
}

export async function completeRun(runId, { usage = null, error = null } = {}) {
  if (!runId) return null;
  if (error) {
    return updateRunStatus(runId, RunStatus.FAILED, { error });
  }
  if (usage) {
    await appendRunStep(runId, {
      type: StepType.SYSTEM,
      status: "ok",
      metadata: { event: "run_completed", usage },
    });
  }
  return updateRunStatus(runId, RunStatus.COMPLETED);
}

export async function cancelRun(runId, reason = "cancelled") {
  if (!runId) return null;
  return updateRunStatus(runId, RunStatus.CANCELLED, {
    error: { code: "cancelled", message: reason },
  });
}

/**
 * Read-only replay: new run with same step trace (dry-run simulated tool outputs).
 */
export async function replayRun(sourceRunId, { dryRun = true, createdBy = "replay" } = {}) {
  const source = await getRun(sourceRunId);
  if (!source) return null;

  const steps = await listRunSteps(sourceRunId, { limit: 500 });
  const run = await createRun({
    goal: `[replay] ${source.goal || sourceRunId}`,
    projectId: source.projectId,
    conversationId: null,
    createdBy,
    plan: source.plan,
    metadata: { replayOf: sourceRunId, dryRun },
  });

  for (const step of steps) {
    await appendRunStep(run.id, {
      type: step.type,
      toolName: step.toolName,
      input: step.input,
      output: dryRun && step.type === StepType.TOOL
        ? { dryRun: true, replayed: true, original: step.output }
        : step.output,
      status: step.status,
      durationMs: step.durationMs,
      usage: step.usage,
      metadata: { ...step.metadata, replay: true, sourceStepId: step.id },
    });
  }

  await completeRun(run.id, { usage: null });
  return getRun(run.id);
}

export async function createRunFromTemplate(templateId, params, { projectId, createdBy, dryRun = false } = {}) {
  const template = getWorkflowTemplate(templateId);
  if (!template) throw new Error(`Unknown template: ${templateId}`);

  const plan = buildPlanFromTemplate(template, params);
  const goal = params.goal || template.name;

  return createRun({
    goal,
    projectId: projectId || null,
    createdBy: createdBy || "api",
    plan,
    metadata: { templateId, parameters: params, dryRun },
  });
}

export { listWorkflowTemplates };
