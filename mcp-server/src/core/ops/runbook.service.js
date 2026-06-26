/**
 * Runbook service — preflight, execute, post-run reports.
 */

import { getWorkflowTemplateById } from "../agent-runs/workflow-template-store.js";
import {
  listRunbooks,
  getRunbookById,
  getRunbookVersions,
  createRunbook,
  updateRunbook,
  deleteRunbook,
  recordRunbookExecution,
  listRunbookExecutions,
} from "./runbook-store.js";
import { preflightRunGuardrails, estimateTemplateCost } from "../usage/cost-guardrails.service.js";
import {
  resolveAutonomyLevel,
  evaluateAutonomyForRunSpawn,
} from "./autonomy.service.js";
import { createRunFromTemplate } from "../agent-runs/run-orchestrator.js";
import { submitJob } from "../jobs.js";
import { WORKFLOW_RUN_JOB_TYPE } from "../agent-runs/workflow-run-job.js";
import { linkRunToJob } from "../agent-runs/agent-run-job.js";
import { assertRunbookForceAllowed } from "./runbook-force-guard.js";

export {
  listRunbooks,
  getRunbookById,
  getRunbookVersions,
  createRunbook,
  updateRunbook,
  deleteRunbook,
  listRunbookExecutions,
};

export function buildPostRunReport({ runbook, run = null, preflight, outcome, actor = "api" }) {
  return {
    template: runbook.postRunReportTemplate || "default",
    generatedAt: new Date().toISOString(),
    runbookId: runbook.id,
    runbookName: runbook.name,
    runbookVersion: runbook.version,
    runbookType: runbook.type,
    owner: runbook.owner,
    slaMinutes: runbook.slaMinutes,
    outcome,
    actor,
    runId: run?.id || null,
    runStatus: run?.status || null,
    preflight: preflight
      ? {
          allowed: preflight.allowed,
          blocked: preflight.blocked,
          requiresApproval: preflight.requiresApproval,
          warnings: preflight.warnings || [],
          autonomy: preflight.autonomy,
        }
      : null,
    summary:
      outcome === "started"
        ? `Runbook ${runbook.name} started as run ${run?.id}`
        : outcome === "preflight_failed"
          ? `Runbook ${runbook.name} blocked by preflight`
          : outcome === "pending_approval"
            ? `Runbook ${runbook.name} awaiting approval`
            : `Runbook ${runbook.name} — ${outcome}`,
  };
}

export async function preflightRunbook(runbookId, { parameters = {}, projectId = null, projectEnv = "development" } = {}) {
  const runbook = getRunbookById(runbookId);
  if (!runbook) {
    return { ok: false, error: { code: "not_found", message: `Runbook not found: ${runbookId}` } };
  }
  if (!runbook.enabled) {
    return { ok: false, error: { code: "disabled", message: "Runbook is disabled" } };
  }

  const template = getWorkflowTemplateById(runbook.templateId);
  if (!template) {
    return { ok: false, error: { code: "template_not_found", message: `Template not found: ${runbook.templateId}` } };
  }

  const mergedParams = { ...runbook.defaultParameters, ...parameters };
  const estimate = estimateTemplateCost(runbook.templateId, mergedParams);
  const autonomyLevel = resolveAutonomyLevel({
    projectId,
    projectEnv,
    runbookId,
    explicitLevel: runbook.autonomyLevel,
  });

  const autonomy = evaluateAutonomyForRunSpawn({
    level: autonomyLevel,
    projectId,
    projectEnv,
    templateId: runbook.templateId,
    estimatedCostUsd: estimate?.estimatedCostUsd ?? 0,
    source: "manual",
  });

  const checks = runbook.preflightChecks || [];
  let guardrails = null;
  if (checks.some((c) => ["quota", "cost", "policy"].includes(c))) {
    guardrails = await preflightRunGuardrails({
      templateId: runbook.templateId,
      parameters: mergedParams,
      projectId,
      projectEnv,
    });
  }

  const blockedByAutonomy = !autonomy.allowed;
  const blockedByGuardrails = guardrails ? !guardrails.allowed : false;
  const requiresApproval =
    autonomy.requiresApproval ||
    guardrails?.requiresApproval ||
    (runbook.requiredApprovals?.length > 0);

  const blocked = blockedByAutonomy || blockedByGuardrails;
  const warnings = [
    ...(guardrails?.warnings || []),
    ...autonomy.reasons.filter((r) => !blocked),
  ];

  const result = {
    ok: true,
    runbookId,
    runbookVersion: runbook.version,
    allowed: !blocked && !requiresApproval,
    blocked,
    requiresApproval,
    autonomy,
    guardrails,
    estimate,
    parameters: mergedParams,
    warnings,
    checks: checks.map((name) => ({
      name,
      passed: name === "autonomy" ? !blockedByAutonomy : name === "quota" || name === "cost" || name === "policy" ? !blockedByGuardrails : true,
    })),
  };

  result.report = buildPostRunReport({
    runbook,
    preflight: result,
    outcome: blocked ? "preflight_failed" : requiresApproval ? "pending_approval" : "preflight_ok",
  });

  return result;
}

export async function executeRunbook(
  runbookId,
  {
    parameters = {},
    projectId = null,
    projectEnv = "development",
    createdBy = "api",
    dryRun = false,
    force = false,
    forceInternal = false,
  } = {}
) {
  const runbook = getRunbookById(runbookId);
  if (!runbook) {
    throw Object.assign(new Error(`Runbook not found: ${runbookId}`), { code: "not_found" });
  }

  const forceApplied = force
    ? assertRunbookForceAllowed({ requested: true, internal: forceInternal })
    : false;

  const preflight = await preflightRunbook(runbookId, { parameters, projectId, projectEnv });

  if (!forceApplied) {
    if (preflight.blocked) {
      recordRunbookExecution(runbookId, {
        outcome: "preflight_failed",
        projectId,
        actor: createdBy,
        preflight,
      });
      return {
        started: false,
        outcome: "preflight_failed",
        preflight,
        postRunReport: preflight.report,
      };
    }

    if (preflight.requiresApproval) {
      recordRunbookExecution(runbookId, {
        outcome: "pending_approval",
        projectId,
        actor: createdBy,
        preflight,
      });
      return {
        started: false,
        outcome: "pending_approval",
        preflight,
        postRunReport: buildPostRunReport({ runbook, preflight, outcome: "pending_approval", actor: createdBy }),
        requiredApprovals: runbook.requiredApprovals,
      };
    }
  }

  const mergedParams = preflight.parameters || { ...runbook.defaultParameters, ...parameters };
  const run = await createRunFromTemplate(runbook.templateId, mergedParams, {
    projectId,
    createdBy,
    dryRun,
    metadataExtra: {
      runbookId: runbook.id,
      runbookVersion: runbook.version,
      runbookType: runbook.type,
    },
  });

  const job = submitJob(
    WORKFLOW_RUN_JOB_TYPE,
    {
      runId: run.id,
      templateId: runbook.templateId,
      params: mergedParams,
      dryRun,
      context: { projectId, projectEnv, user: createdBy },
    },
    { projectId, user: createdBy }
  );
  linkRunToJob(run.id, job.id);

  recordRunbookExecution(runbookId, {
    outcome: "started",
    runId: run.id,
    jobId: job.id,
    projectId,
    actor: createdBy,
    forced: forceApplied,
  });

  const postRunReport = buildPostRunReport({
    runbook,
    run,
    preflight,
    outcome: "started",
    actor: createdBy,
  });

  return {
    started: true,
    outcome: "started",
    run,
    jobId: job.id,
    preflight,
    postRunReport,
  };
}
