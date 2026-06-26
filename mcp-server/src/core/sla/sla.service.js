/**
 * SLA evaluator + escalation executor.
 */

import { getApprovalStore } from "../policy-hooks.js";
import { pauseSchedule } from "../ops/schedule-store.js";
import { getScheduleById } from "../ops/schedule-store.js";
import { getTool } from "../tool-registry.js";
import {
  getSlaPolicy,
  setSlaPolicy,
  recordViolation,
  listViolations,
  getFailureStreak,
  incrementFailureStreak,
  resetFailureStreak,
  isApprovalEscalated,
  markApprovalEscalated,
} from "./sla-store.js";

export { getSlaPolicy, setSlaPolicy, listViolations };

function hoursSince(iso) {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000);
}

async function notifyOwner(message, { projectId, title = "SLA Escalation" } = {}) {
  const tool = getTool("notifications_send");
  if (!tool?.handler) {
    console.warn("[sla] notify:", title, message.slice(0, 120));
    return { ok: true, channel: "log" };
  }
  try {
    return await tool.handler({
      channel: "auto",
      title,
      message,
      explanation: "SLA escalation notification",
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function createGithubIssue({ repo, title, body }) {
  if (!repo || !process.env.GITHUB_TOKEN) {
    return { ok: false, skipped: true, reason: "no_github_token_or_repo" };
  }
  const parts = String(repo).split("/");
  if (parts.length !== 2) return { ok: false, skipped: true };
  try {
    const { githubRequest } = await import("../../plugins/github/github.client.js");
    const result = await githubRequest("POST", `/repos/${parts[0]}/${parts[1]}/issues`, { title, body });
    return result;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function executeEscalation(rule, context) {
  const actions = [];
  const { action, target } = rule;

  if (action === "notify" || action === "notify_and_issue") {
    const notify = await notifyOwner(context.message, { projectId: context.projectId, title: context.title });
    actions.push({ type: "notify", result: notify });
  }

  if (action === "notify_and_issue" && context.repo) {
    const issue = await createGithubIssue({
      repo: context.repo,
      title: context.title || "SLA violation",
      body: context.message,
    });
    actions.push({ type: "github_issue", result: issue });
  }

  if (action === "pause_schedule" && context.scheduleId) {
    const schedule = pauseSchedule(context.scheduleId, true);
    actions.push({ type: "pause_schedule", scheduleId: context.scheduleId, result: schedule });
  }

  const violation = recordViolation({
    rule: context.ruleType,
    projectId: context.projectId,
    message: context.message,
    actions,
  });

  return { violation, actions };
}

export async function evaluateApprovalTimeouts({ projectId = null } = {}) {
  const store = getApprovalStore();
  if (!store?.listApprovals) return { checked: 0, escalated: 0, results: [] };

  const policy = getSlaPolicy(projectId || "default");
  const pending = store.listApprovals({ status: "pending" });
  const results = [];

  for (const approval of pending) {
    if (isApprovalEscalated(approval.id)) continue;
    const ageHours = hoursSince(approval.createdAt || approval.requestedAt);
    if (ageHours < policy.approvalTimeoutHours) continue;

    const result = await executeEscalation(policy.actions.approvalTimeout, {
      ruleType: "approval_timeout",
      projectId: projectId || approval.projectId,
      title: `Approval timeout: ${approval.toolName || approval.id}`,
      message: `Approval ${approval.id} pending for ${Math.floor(ageHours)}h (threshold ${policy.approvalTimeoutHours}h). Tool: ${approval.toolName || "unknown"}`,
      repo: approval.repo || process.env.SLA_ESCALATION_REPO || null,
    });
    markApprovalEscalated(approval.id);
    results.push({ approvalId: approval.id, ...result });
  }

  return { checked: pending.length, escalated: results.length, results };
}

export function recordScheduleRunOutcome(scheduleId, outcome) {
  if (!scheduleId) return null;
  const policy = getSlaPolicy("default");
  const isFailure = ["blocked", "error", "preflight_failed"].includes(outcome);

  if (isFailure) {
    const streak = incrementFailureStreak(scheduleId);
    if (streak >= policy.runFailureThreshold) {
      return { scheduleId, streak, shouldEscalate: true };
    }
    return { scheduleId, streak, shouldEscalate: false };
  }

  resetFailureStreak(scheduleId);
  return { scheduleId, streak: 0, shouldEscalate: false };
}

export async function evaluateScheduleFailures() {
  const policy = getSlaPolicy("default");
  const { listSchedules } = await import("../ops/schedule-store.js");
  const schedules = listSchedules();
  const results = [];

  for (const schedule of schedules) {
    const streak = getFailureStreak(schedule.id);
    if (streak < policy.runFailureThreshold) continue;
    if (schedule.paused) continue;

    const result = await executeEscalation(policy.actions.runFailure, {
      ruleType: "run_failure_streak",
      projectId: schedule.projectId,
      scheduleId: schedule.id,
      title: `Schedule paused: ${schedule.name}`,
      message: `Schedule ${schedule.id} failed ${streak} times — auto-paused per SLA policy`,
    });
    results.push(result);
  }

  return { evaluated: schedules.length, escalated: results.length, results };
}

export async function evaluateCostThreshold({ projectId, estimatedCostUsd, runId }) {
  const policy = getSlaPolicy(projectId || "default");
  if (estimatedCostUsd <= policy.costThresholdUsd) return { exceeded: false };

  const result = await executeEscalation(policy.actions.costExceeded, {
    ruleType: "cost_threshold",
    projectId,
    title: `Cost threshold exceeded on run ${runId}`,
    message: `Estimated cost $${estimatedCostUsd} exceeds SLA limit $${policy.costThresholdUsd}`,
  });

  return { exceeded: true, ...result };
}

export function getSlaDashboard({ projectId = null } = {}) {
  const violations = listViolations({ projectId, limit: 200 });
  const byRule = {};
  for (const v of violations) {
    const rule = v.rule || "unknown";
    byRule[rule] = (byRule[rule] || 0) + 1;
  }

  const last7d = violations.filter((v) => {
    const age = Date.now() - new Date(v.at).getTime();
    return age <= 7 * 24 * 60 * 60 * 1000;
  });

  return {
    projectId,
    totalViolations: violations.length,
    violationsLast7d: last7d.length,
    byRule,
    recent: violations.slice(0, 10),
    mttrMinutesEstimate: violations.length ? Math.round(60 + violations.length * 15) : null,
    generatedAt: new Date().toISOString(),
  };
}

export async function runSlaEvaluation() {
  const [approvals, schedules] = await Promise.all([
    evaluateApprovalTimeouts(),
    evaluateScheduleFailures(),
  ]);
  return {
    evaluatedAt: new Date().toISOString(),
    approvals,
    schedules,
  };
}
