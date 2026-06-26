/**
 * Agent-centric observability aggregation (V6.7).
 */

import { listRuns, listRunSteps } from "../agent-runs/agent-runs.service.js";
import { getApprovalStore } from "../policy-hooks.js";
import { queryEvents } from "../usage/usage-ledger.service.js";
import { listViolations } from "../sla/sla-store.js";
import { listTrustScores } from "../v6/trust.service.js";

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function withinDays(iso, days) {
  if (!iso) return false;
  return new Date(iso).getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
}

export async function getObservabilityProDashboard({ projectId = null, days = 7 } = {}) {
  const from = daysAgoIso(days);
  const runs = await listRuns({ projectId, limit: 400 });
  const recentRuns = runs.filter((r) => withinDays(r.updatedAt || r.finishedAt || r.createdAt, days));

  const toolFailures = {};
  const toolCalls = {};
  const toolDurations = {};

  for (const run of recentRuns) {
    const steps = await listRunSteps(run.id, { limit: 300 });
    for (const step of steps) {
      if (step.type !== "tool") continue;
      const tool = step.toolName || step.tool_name || "unknown";
      toolCalls[tool] = (toolCalls[tool] || 0) + 1;
      if (step.status && step.status !== "ok") {
        toolFailures[tool] = (toolFailures[tool] || 0) + 1;
      }
      if (step.durationMs) {
        toolDurations[tool] = toolDurations[tool] || [];
        toolDurations[tool].push(step.durationMs);
      }
    }
  }

  const failureHotspots = Object.keys({ ...toolCalls, ...toolFailures })
    .map((tool) => {
      const calls = toolCalls[tool] || 0;
      const fails = toolFailures[tool] || 0;
      const durations = toolDurations[tool] || [];
      const avgMs = durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;
      return {
        tool,
        calls,
        fails,
        failRate: calls ? Math.round((fails / calls) * 1000) / 1000 : 0,
        avgDurationMs: avgMs,
      };
    })
    .filter((x) => x.fails > 0 || x.calls >= 3)
    .sort((a, b) => b.fails - a.fails || b.failRate - a.failRate)
    .slice(0, 12);

  const store = getApprovalStore();
  const pending = store?.listApprovals?.({ status: "pending" }) || [];
  const approvalByTool = {};
  let oldestPendingHours = 0;
  for (const a of pending) {
    const tool = a.toolName || "unknown";
    approvalByTool[tool] = (approvalByTool[tool] || 0) + 1;
    const hours = (Date.now() - new Date(a.createdAt).getTime()) / (60 * 60 * 1000);
    if (hours > oldestPendingHours) oldestPendingHours = hours;
  }

  const approvalBottlenecks = Object.entries(approvalByTool)
    .map(([tool, count]) => ({ tool, pendingCount: count }))
    .sort((a, b) => b.pendingCount - a.pendingCount)
    .slice(0, 10);

  const reliabilityTrend = {};
  for (const run of recentRuns) {
    const day = (run.finishedAt || run.updatedAt || run.createdAt || "").slice(0, 10);
    if (!day) continue;
    if (!reliabilityTrend[day]) reliabilityTrend[day] = { date: day, completed: 0, failed: 0, total: 0 };
    reliabilityTrend[day].total += 1;
    if (run.status === "completed") reliabilityTrend[day].completed += 1;
    if (run.status === "failed") reliabilityTrend[day].failed += 1;
  }

  const { events } = await queryEvents({ from, projectId, limit: 1000 });
  const costByTool = {};
  const costByModel = {};
  let totalCostUsd = 0;
  for (const e of events) {
    const cost = e.estimatedCostUsd || 0;
    totalCostUsd += cost;
    const tool = e.toolName || "llm";
    costByTool[tool] = (costByTool[tool] || 0) + cost;
    if (e.model) costByModel[e.model] = (costByModel[e.model] || 0) + cost;
  }

  const costHotspots = Object.entries(costByTool)
    .map(([tool, costUsd]) => ({ tool, costUsd: Math.round(costUsd * 10000) / 10000 }))
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 10);

  const modelLatency = Object.entries(costByModel)
    .map(([model, costUsd]) => ({ model, costUsd: Math.round(costUsd * 10000) / 10000 }))
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 8);

  const violations = listViolations({ projectId, limit: 50 }).filter((v) =>
    withinDays(v.at || v.createdAt, days)
  );

  return {
    windowDays: days,
    projectId,
    generatedAt: new Date().toISOString(),
    runs: {
      total: recentRuns.length,
      completed: recentRuns.filter((r) => r.status === "completed").length,
      failed: recentRuns.filter((r) => r.status === "failed").length,
      waitingApproval: recentRuns.filter((r) => r.status === "waiting_approval").length,
    },
    failureHotspots,
    approvalBottlenecks,
    approvalQueue: {
      pending: pending.length,
      oldestPendingHours: Math.round(oldestPendingHours * 10) / 10,
    },
    reliabilityTrend: Object.values(reliabilityTrend).sort((a, b) => a.date.localeCompare(b.date)),
    costHotspots,
    modelCost: modelLatency,
    totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
    slaViolations: violations.length,
    trustScores: listTrustScores().slice(0, 8),
  };
}
