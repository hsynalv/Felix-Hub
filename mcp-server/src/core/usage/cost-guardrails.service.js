/**
 * Cost guardrails — preflight estimates, anomaly detection, policy+cost merge.
 */

import { getWorkflowTemplate, buildPlanFromTemplate } from "../agent-runs/workflow-templates.js";
import { queryProjectUsage, queryRunUsage } from "./usage-ledger.service.js";
import { checkQuota } from "./quota.service.js";
import { evaluateTool } from "../../plugins/policy/policy.engine.js";
import { PROTECTED_TOOLS } from "../approvals/approval-risk.js";
import { getTool } from "../tool-registry.js";

/** Rough per-tool USD estimates for preflight (heuristic). */
const TOOL_COST_USD = {
  repo_analyze: 0.02,
  repo_summary: 0.01,
  code_review_suggest_fix: 0.15,
  code_review_file: 0.08,
  github_pr_create: 0.01,
  tests_run: 0.005,
  git_commit: 0.001,
  workspace_search: 0.02,
  llm_route: 0.05,
  agent_run: 0.25,
};

const DESTRUCTIVE_TAGS = new Set(["destructive", "write", "needs_approval"]);

function estimateToolCost(toolName) {
  if (TOOL_COST_USD[toolName] != null) return TOOL_COST_USD[toolName];
  const tool = getTool(toolName);
  const tags = tool?.tags || [];
  if (tags.includes("EXTERNAL_API")) return 0.03;
  if (tags.includes("BULK")) return 0.02;
  if (tags.some((t) => DESTRUCTIVE_TAGS.has(t))) return 0.01;
  return 0.005;
}

function isDestructiveTool(toolName) {
  if (PROTECTED_TOOLS.has(toolName)) return true;
  const tool = getTool(toolName);
  return (tool?.tags || []).some((t) => t === "destructive" || t === "NEEDS_APPROVAL");
}

/** Preflight cost estimate for a workflow template plan. */
export function estimateTemplateCost(templateId, parameters = {}) {
  const template = getWorkflowTemplate(templateId);
  if (!template) {
    return { ok: false, error: { code: "template_not_found", message: `Unknown template: ${templateId}` } };
  }

  const plan = buildPlanFromTemplate(template, parameters);
  const toolPhases = plan.phases.filter((p) => p.type === "tool" && p.toolName);
  const breakdown = toolPhases.map((p) => ({
    toolName: p.toolName,
    estimatedUsd: estimateToolCost(p.toolName),
    destructive: isDestructiveTool(p.toolName),
  }));

  const estimatedCostUsd = breakdown.reduce((sum, b) => sum + b.estimatedUsd, 0);
  const destructiveSteps = breakdown.filter((b) => b.destructive).length;
  const approvalSteps = plan.phases.filter((p) => p.type === "approval").length;

  return {
    ok: true,
    templateId,
    stepCount: plan.phases.length,
    toolCount: toolPhases.length,
    estimatedCostUsd: Math.round(estimatedCostUsd * 10000) / 10000,
    destructiveSteps,
    approvalSteps,
    breakdown,
    note: "Heuristic estimate — actual cost depends on LLM tokens and retries",
  };
}

/** Preflight for an existing run (usage so far + remaining estimate if template). */
export async function estimateRunPreflight(run) {
  let usage = null;
  try {
    usage = await queryRunUsage(run.id);
  } catch {
    usage = null;
  }

  const templateId = run.metadata?.templateId;
  let remaining = null;
  if (templateId) {
    remaining = estimateTemplateCost(templateId, run.metadata?.parameters || {});
  }

  return {
    runId: run.id,
    status: run.status,
    usageSoFar: usage?.totals || { estimatedCostUsd: 0, totalTokens: 0 },
    remainingEstimate: remaining?.estimatedCostUsd ?? null,
    totalEstimateUsd:
      (usage?.totals?.estimatedCostUsd ?? 0) + (remaining?.estimatedCostUsd ?? 0),
    breakdown: remaining?.breakdown || [],
  };
}

/**
 * Policy + cost combined evaluation.
 * Production destructive tool + estimatedCost > threshold → require_approval.
 */
export function evaluateCostPolicy({
  toolName,
  estimatedCostUsd = 0,
  projectEnv = "development",
  projectId = null,
  costThresholdUsd = 2,
}) {
  const policyResult = evaluateTool(toolName, {}, {
    projectEnv,
    projectId,
    user: "cost-guardrail",
  });

  const destructive = isDestructiveTool(toolName);
  const isProduction = String(projectEnv).toLowerCase() === "production";
  const costExceeded = estimatedCostUsd > costThresholdUsd;

  let action = policyResult.allowed ? "allow" : policyResult.action || "block";
  let requiresApproval = action === "require_approval";
  const reasons = [];

  if (!policyResult.allowed && policyResult.action) {
    reasons.push(policyResult.explanation || policyResult.message || "Policy denied");
  }

  if (isProduction && destructive && costExceeded) {
    action = "require_approval";
    requiresApproval = true;
    reasons.push(
      `Production destructive tool with estimated cost $${estimatedCostUsd.toFixed(2)} > $${costThresholdUsd}`
    );
  }

  return {
    allowed: action === "allow",
    action,
    requiresApproval,
    destructive,
    estimatedCostUsd,
    costThresholdUsd,
    policy: policyResult,
    reasons,
  };
}

/** Detect cost anomalies — compare recent vs prior window. */
export async function detectCostAnomalies(projectId, { windowDays = 7 } = {}) {
  const recent = await queryProjectUsage(projectId, { days: windowDays });
  const prior = await queryProjectUsage(projectId, { days: windowDays * 2 });

  const recentCost = recent.totals?.estimatedCostUsd ?? 0;
  const priorCost = Math.max(0, (prior.totals?.estimatedCostUsd ?? 0) - recentCost);
  const recentTokens = recent.totals?.totalTokens ?? 0;
  const priorTokens = Math.max(0, (prior.totals?.totalTokens ?? 0) - recentTokens);

  const costRatio = priorCost > 0 ? recentCost / priorCost : recentCost > 0 ? 2 : 1;
  const tokenRatio = priorTokens > 0 ? recentTokens / priorTokens : recentTokens > 0 ? 2 : 1;

  const anomalies = [];
  if (costRatio >= 1.5 && recentCost > 0.5) {
    anomalies.push({
      type: "cost_spike",
      level: costRatio >= 2 ? "high" : "medium",
      message: `Son ${windowDays} gün maliyeti önceki döneme göre ${(costRatio * 100).toFixed(0)}%`,
      recentCostUsd: recentCost,
      priorCostUsd: priorCost,
      ratio: costRatio,
    });
  }
  if (tokenRatio >= 1.5 && recentTokens > 10_000) {
    anomalies.push({
      type: "token_spike",
      level: tokenRatio >= 2 ? "high" : "medium",
      message: `Token kullanımı ${(tokenRatio * 100).toFixed(0)}% arttı`,
      recentTokens,
      priorTokens,
      ratio: tokenRatio,
    });
  }

  return {
    projectId,
    windowDays,
    recent: recent.totals,
    prior: { estimatedCostUsd: priorCost, totalTokens: priorTokens },
    anomalies,
    hasAnomalies: anomalies.length > 0,
  };
}

/** Full guardrail check before starting a run. */
export async function preflightRunGuardrails({ templateId, parameters = {}, projectId, projectEnv = "development" }) {
  const quota = await checkQuota({ projectId: projectId || "default" });
  const estimate = templateId ? estimateTemplateCost(templateId, parameters) : null;
  const anomalies = projectId ? await detectCostAnomalies(projectId).catch(() => null) : null;

  const policyChecks = (estimate?.breakdown || [])
    .filter((b) => b.destructive)
    .map((b) =>
      evaluateCostPolicy({
        toolName: b.toolName,
        estimatedCostUsd: estimate.estimatedCostUsd,
        projectEnv,
        projectId,
      })
    );

  const requiresApproval = policyChecks.some((p) => p.requiresApproval);
  const blocked = !quota.allowed || policyChecks.some((p) => p.action === "block");

  return {
    allowed: !blocked,
    blocked,
    requiresApproval,
    quota,
    estimate,
    anomalies,
    policyChecks,
    warnings: [
      ...(quota.warning ? ["Quota warning"] : []),
      ...(anomalies?.hasAnomalies ? ["Cost anomaly detected"] : []),
      ...(requiresApproval ? ["Approval required for high-cost destructive steps"] : []),
    ],
  };
}
