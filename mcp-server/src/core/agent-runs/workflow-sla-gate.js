/**
 * Runtime SLA re-check for L4/L5 workflow steps.
 */

import { resolveAutonomyLevel } from "../ops/autonomy.service.js";
import {
  evaluateApprovalTimeouts,
  evaluateScheduleFailures,
  evaluateCostThreshold,
} from "../sla/sla.service.js";

export async function enforceWorkflowStepSla(context = {}) {
  const level = resolveAutonomyLevel({
    projectId: context.projectId ?? null,
    projectEnv: context.projectEnv || context.environment || "development",
    runbookId: context.runbookId ?? null,
    scheduleId: context.scheduleId ?? null,
    explicitLevel: context.autonomyLevel ?? null,
  });

  if (level !== "L4" && level !== "L5") {
    return { ok: true, level, skipped: true };
  }

  const [approvals, schedules] = await Promise.all([
    evaluateApprovalTimeouts({ projectId: context.projectId }),
    evaluateScheduleFailures(),
  ]);

  if (context.estimatedCostUsd > 0 && context.runId) {
    const cost = await evaluateCostThreshold({
      projectId: context.projectId,
      estimatedCostUsd: context.estimatedCostUsd,
      runId: context.runId,
    });
    if (cost.exceeded) {
      return {
        ok: false,
        code: "sla_cost_exceeded",
        level,
        message: `Estimated cost $${context.estimatedCostUsd} exceeds SLA threshold`,
        details: cost,
      };
    }
  }

  return {
    ok: true,
    level,
    slaChecks: {
      approvalsEscalated: approvals.escalated,
      schedulesEscalated: schedules.escalated,
    },
  };
}
