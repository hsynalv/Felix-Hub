/**
 * Schedule policy validation — L4/L5 require SLA + escalation config.
 */

import { AUTONOMY_LEVELS } from "./autonomy.service.js";
import { getSlaPolicy } from "../sla/sla.service.js";

export function validateSchedulePolicy(input, { projectId = null } = {}) {
  const level = input.autonomyLevel || "L4";
  const projectEnv = input.projectEnv || "development";
  const errors = [];

  if (!AUTONOMY_LEVELS.includes(level)) {
    errors.push(`Invalid autonomy level: ${level}`);
  }

  if (level === "L4" || level === "L5") {
    const sla = getSlaPolicy(projectId || "default");
    if (!sla.approvalTimeoutHours || !sla.runFailureThreshold) {
      errors.push("L4/L5 schedules require SLA policy (approvalTimeoutHours, runFailureThreshold)");
    }
    if (level === "L5" && String(projectEnv).toLowerCase() === "production") {
      if (!sla.actions?.runFailure?.action) {
        errors.push("L5 production schedules require SLA escalation actions configured");
      }
      if (!input.maxCostUsd || input.maxCostUsd <= 0) {
        errors.push("L5 production schedules require maxCostUsd > 0");
      }
    }
  }

  if (errors.length) {
    throw Object.assign(new Error(errors.join("; ")), { code: "schedule_policy", details: errors });
  }

  return { level, projectEnv, slaRequired: level === "L4" || level === "L5" };
}
