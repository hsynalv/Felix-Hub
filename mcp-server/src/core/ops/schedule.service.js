/**
 * Agent schedule service — skip conditions, fire, test run.
 */

import { cronMatches } from "./cron-match.js";
import {
  listSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  pauseSchedule,
  recordScheduleFire,
  listScheduleHistory,
} from "./schedule-store.js";
import { getRunbookById } from "./runbook-store.js";
import { executeRunbook, preflightRunbook } from "./runbook.service.js";
import { estimateTemplateCost } from "../usage/cost-guardrails.service.js";
import { detectCostAnomalies } from "../usage/cost-guardrails.service.js";
import { resolveAutonomyLevel, evaluateAutonomyForRunSpawn } from "./autonomy.service.js";
import { recordScheduleRunOutcome } from "../sla/sla.service.js";
import { createRunFromTemplate } from "../agent-runs/run-orchestrator.js";
import { submitJob } from "../jobs.js";
import { WORKFLOW_RUN_JOB_TYPE } from "../agent-runs/workflow-run-job.js";
import { linkRunToJob } from "../agent-runs/agent-run-job.js";

export {
  listSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  pauseSchedule,
  listScheduleHistory,
};

/** Evaluate skip_if condition before firing a schedule. */
export async function evaluateSkipCondition(skipIf, { projectId = null } = {}) {
  if (!skipIf) return { skip: false };

  if (skipIf.type === "cost_anomaly") {
    if (!projectId) return { skip: false };
    const anomalies = await detectCostAnomalies(projectId).catch(() => null);
    const skip = !!anomalies?.hasAnomalies;
    return { skip, reason: skip ? "cost_anomaly_detected" : null };
  }

  if (skipIf.type === "open_incident") {
    const flag = process.env[`INCIDENT_OPEN_${projectId || "default"}`];
    const skip = flag === "true" || flag === "1";
    return { skip, reason: skip ? "open_incident" : null };
  }

  if (skipIf.type === "env_flag" && skipIf.key) {
    const skip = process.env[skipIf.key] === "true" || process.env[skipIf.key] === "1";
    return { skip, reason: skip ? skipIf.key : null };
  }

  return { skip: false };
}

export function listDueSchedules(now = new Date()) {
  return listSchedules().filter((s) => {
    if (!s.enabled || s.paused) return false;
    if (!s.cronExpr) return false;
    if (s.lastRunAt) {
      const last = new Date(s.lastRunAt);
      if (now.getTime() - last.getTime() < 55_000) return false;
    }
    return cronMatches(s.cronExpr, now, s.timezone || "UTC");
  });
}

export async function fireSchedule(scheduleId, { test = false, actor = "scheduler" } = {}) {
  const schedule = getScheduleById(scheduleId);
  if (!schedule) {
    throw Object.assign(new Error(`Schedule not found: ${scheduleId}`), { code: "not_found" });
  }

  const skip = await evaluateSkipCondition(schedule.skipIf, { projectId: schedule.projectId });
  if (skip.skip) {
    recordScheduleFire(scheduleId, { outcome: "skipped", reason: skip.reason, test });
    return { fired: false, outcome: "skipped", reason: skip.reason, schedule };
  }

  if (schedule.reportType) {
    const { generateBriefing, deliverBriefing } = await import("../reports/briefing.service.js");
    const briefing = await generateBriefing({
      type: schedule.reportType,
      projectId: schedule.projectId || "default",
    });
    const delivery = await deliverBriefing(briefing.id, { channel: schedule.notifyTarget || "native" });
    recordScheduleFire(scheduleId, { outcome: "briefing_generated", briefingId: briefing.id, test });
    recordScheduleRunOutcome(scheduleId, "started");
    return { fired: true, outcome: "briefing_generated", briefing, delivery, schedule };
  }

  const templateId = schedule.templateId || (schedule.runbookId ? getRunbookById(schedule.runbookId)?.templateId : null);
  const estimate = templateId
    ? estimateTemplateCost(templateId, schedule.parameters || {})
    : { estimatedCostUsd: 0 };

  if (schedule.maxCostUsd != null && (estimate?.estimatedCostUsd ?? 0) > schedule.maxCostUsd) {
    recordScheduleFire(scheduleId, {
      outcome: "skipped",
      reason: `cost_exceeds_max_${schedule.maxCostUsd}`,
      test,
    });
    return {
      fired: false,
      outcome: "skipped",
      reason: `estimated cost exceeds max $${schedule.maxCostUsd}`,
      estimate,
      schedule,
    };
  }

  const autonomyLevel = resolveAutonomyLevel({
    projectId: schedule.projectId,
    projectEnv: schedule.projectEnv,
    scheduleId: schedule.id,
    runbookId: schedule.runbookId,
    explicitLevel: schedule.autonomyLevel,
  });

  const autonomy = evaluateAutonomyForRunSpawn({
    level: autonomyLevel,
    projectId: schedule.projectId,
    projectEnv: schedule.projectEnv,
    templateId,
    estimatedCostUsd: estimate?.estimatedCostUsd ?? 0,
    maxCostUsd: schedule.maxCostUsd,
    source: "schedule",
  });

  if (!autonomy.allowed) {
    recordScheduleFire(scheduleId, { outcome: "blocked", reason: autonomy.reasons.join("; "), test });
    recordScheduleRunOutcome(scheduleId, "blocked");
    return { fired: false, outcome: "blocked", autonomy, schedule };
  }

  if (schedule.runbookId) {
    const result = await executeRunbook(schedule.runbookId, {
      parameters: schedule.parameters,
      projectId: schedule.projectId,
      projectEnv: schedule.projectEnv,
      createdBy: actor,
      dryRun: test,
      forceInternal: false,
    });

    recordScheduleFire(scheduleId, {
      outcome: result.outcome,
      runId: result.run?.id,
      jobId: result.jobId,
      test,
    });
    recordScheduleRunOutcome(scheduleId, result.started ? "started" : result.outcome);

    return { fired: result.started, ...result, schedule };
  }

  if (!schedule.templateId) {
    recordScheduleFire(scheduleId, { outcome: "error", reason: "no_target", test });
    recordScheduleRunOutcome(scheduleId, "error");
    return { fired: false, outcome: "error", reason: "no runbook or template", schedule };
  }

  const run = await createRunFromTemplate(schedule.templateId, schedule.parameters || {}, {
    projectId: schedule.projectId,
    createdBy: actor,
    dryRun: test,
  });

  const job = submitJob(
    WORKFLOW_RUN_JOB_TYPE,
    {
      runId: run.id,
      templateId: schedule.templateId,
      params: schedule.parameters || {},
      dryRun: test,
      context: {
        projectId: schedule.projectId,
        projectEnv: schedule.projectEnv,
        user: actor,
        scheduleId: schedule.id,
      },
    },
    { projectId: schedule.projectId, user: actor }
  );
  linkRunToJob(run.id, job.id);

  recordScheduleFire(scheduleId, { outcome: "started", runId: run.id, jobId: job.id, test });
  recordScheduleRunOutcome(scheduleId, "started");

  return { fired: true, outcome: "started", run, jobId: job.id, schedule };
}

export async function testFireSchedule(scheduleId) {
  return fireSchedule(scheduleId, { test: true, actor: "schedule-test" });
}

export async function preflightSchedule(scheduleId) {
  const schedule = getScheduleById(scheduleId);
  if (!schedule) return { ok: false, error: { code: "not_found" } };

  if (schedule.runbookId) {
    return preflightRunbook(schedule.runbookId, {
      parameters: schedule.parameters,
      projectId: schedule.projectId,
      projectEnv: schedule.projectEnv,
    });
  }

  const templateId = schedule.templateId;
  const estimate = templateId ? estimateTemplateCost(templateId, schedule.parameters || {}) : null;
  const autonomyLevel = resolveAutonomyLevel({
    projectId: schedule.projectId,
    projectEnv: schedule.projectEnv,
    scheduleId: schedule.id,
    explicitLevel: schedule.autonomyLevel,
  });
  const autonomy = evaluateAutonomyForRunSpawn({
    level: autonomyLevel,
    projectId: schedule.projectId,
    projectEnv: schedule.projectEnv,
    templateId,
    estimatedCostUsd: estimate?.estimatedCostUsd ?? 0,
    maxCostUsd: schedule.maxCostUsd,
    source: "schedule",
  });

  return { ok: true, schedule, estimate, autonomy };
}
