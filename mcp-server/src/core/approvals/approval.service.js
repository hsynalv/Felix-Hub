/**
 * Approval Center Pro — detail, risk score, unified decide API.
 */

import { getApprovalStore } from "../policy-hooks.js";
import { resolvePendingApproval } from "../agent-runs/approval-bridge.js";
import { listRunSteps, getRun } from "../agent-runs/agent-runs.service.js";
import { maskBody } from "../audit/index.js";
import { maskSecret } from "../settings/crypto.js";
import { computeRiskScore, PROTECTED_TOOLS } from "./approval-risk.js";

function maskValue(value) {
  if (typeof value === "string") return maskSecret(value);
  if (value && typeof value === "object") return maskBody(value);
  return value;
}

export function sanitizeApprovalBody(body) {
  return maskValue(body);
}

export async function getApprovalDetail(approvalId) {
  const store = getApprovalStore();
  if (!store?.getApproval) return null;
  const approval = store.getApproval(approvalId);
  if (!approval) return null;

  let priorStepOutput = null;
  let run = null;
  if (approval.runId) {
    run = await getRun(approval.runId);
    const steps = await listRunSteps(approval.runId, { limit: 200 });
    const toolSteps = steps.filter((s) => s.type === "tool" && s.status === "ok");
    priorStepOutput = toolSteps.length ? sanitizeApprovalBody(toolSteps[toolSteps.length - 1].output) : null;
  }

  const riskScore =
    approval.riskScore ??
    computeRiskScore({
      toolName: approval.toolName,
      riskLevel: approval.riskLevel,
    });

  return {
    ...approval,
    body: sanitizeApprovalBody(approval.body),
    riskScore,
    riskBreakdown: {
      riskLevel: approval.riskLevel,
      protectedTool: approval.toolName ? PROTECTED_TOOLS.has(approval.toolName) : false,
      score: riskScore,
    },
    run: run ? { id: run.id, goal: run.goal, status: run.status, projectId: run.projectId } : null,
    priorStepOutput,
  };
}

export async function decideApproval(
  approvalId,
  { decision = "approve_once", reason = null, projectId = null } = {},
  { actor = "manual", scopes = [], runId = null } = {}
) {
  const store = getApprovalStore();
  if (!store?.getApproval) {
    throw Object.assign(new Error("Policy system not available"), { code: "policy_unavailable" });
  }

  const approval = store.getApproval(approvalId);
  if (!approval) return null;
  if (approval.status !== "pending") {
    throw Object.assign(new Error(`Approval already ${approval.status}`), { code: "approval_already_processed" });
  }

  if (decision === "deny") {
    const outcome = await resolvePendingApproval(approvalId, false, {
      actor,
      runId: runId || approval.runId,
      scopes,
    });
    return { decision: "deny", outcome, policyRule: null };
  }

  if (decision === "approve_project" && store.addRule) {
    let pid = projectId || null;
    if (!pid && approval.runId) {
      pid = (await getRun(approval.runId))?.projectId ?? null;
    }
    if (pid && approval.toolName) {
      store.addRule({
        toolPattern: approval.toolName,
        projectId: pid,
        action: "allow",
        description: reason || `Auto-allow ${approval.toolName} for project ${pid}`,
        scope: "write",
      });
    }
  }

  const outcome = await resolvePendingApproval(approvalId, true, {
    actor,
    runId: runId || approval.runId,
    scopes,
  });

  return { decision, outcome, policyRule: decision === "approve_project" ? "created" : null };
}

export function listApprovalHistoryUnified({ limit = 50 } = {}) {
  const store = getApprovalStore();
  if (store?.listApprovalHistory) return store.listApprovalHistory({ limit });
  if (store?.listApprovals) {
    return store
      .listApprovals()
      .filter((a) => a.status !== "pending")
      .slice(0, limit);
  }
  return [];
}
