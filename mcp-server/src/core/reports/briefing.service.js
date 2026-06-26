/**
 * Agent reports & briefings — generate, store, deliver.
 */

import { getTodayBriefing, getCommandCenter } from "../project-context/command-center.service.js";
import { listRuns } from "../agent-runs/agent-runs.service.js";
import { queryProjectUsage } from "../usage/usage-ledger.service.js";
import { detectCostAnomalies } from "../usage/cost-guardrails.service.js";
import { checkQuota } from "../usage/quota.service.js";
import { getApprovalStore } from "../policy-hooks.js";
import { listRunbookExecutions } from "../ops/runbook-store.js";
import { listScheduleHistory } from "../ops/schedule-store.js";
import { REPORT_TEMPLATES } from "./report-templates.js";
import {
  listBriefings,
  getBriefingById,
  saveBriefing,
  markBriefingRead,
  archiveBriefing,
  appendDeliveryLog,
} from "./briefing-store.js";
import { getTool } from "../tool-registry.js";

export { listBriefings, getBriefingById, markBriefingRead, archiveBriefing, REPORT_TEMPLATES };

async function gatherReportData(projectId, type) {
  const [briefing, commandCenter, usage7d, usage30d, runs, quota, anomalies] = await Promise.all([
    getTodayBriefing(projectId),
    getCommandCenter(projectId).catch(() => null),
    queryProjectUsage(projectId, { days: 7 }).catch(() => null),
    queryProjectUsage(projectId, { days: 30 }).catch(() => null),
    listRuns({ projectId, limit: 50 }),
    checkQuota(projectId).catch(() => null),
    detectCostAnomalies(projectId).catch(() => null),
  ]);

  const store = getApprovalStore();
  const pendingApprovals = store?.listApprovals ? store.listApprovals({ status: "pending" }) : [];
  const failedRuns = runs.filter((r) => r.status === "failed" || r.status === "error");
  const completedRuns = runs.filter((r) => r.status === "completed");
  const successRate = runs.length ? Math.round((completedRuns.length / runs.length) * 100) : 0;

  return {
    briefing,
    commandCenter,
    usage7d,
    usage30d,
    runs,
    quota,
    anomalies,
    pendingApprovals,
    failedRuns,
    successRate,
    runbookExecutions: listRunbookExecutions({ limit: 20 }),
    scheduleHistory: listScheduleHistory({ limit: 20 }),
  };
}

function renderMarkdown(type, data, projectId) {
  const template = REPORT_TEMPLATES[type];
  const title = template?.title || type;
  const lines = [`# ${title}`, `**Project:** ${projectId}`, `**Generated:** ${new Date().toISOString()}`, ""];

  if (data.briefing) {
    lines.push("## Summary", "", data.briefing.summary, "");
    if (data.briefing.bullets?.length) {
      lines.push("### Highlights", "");
      for (const b of data.briefing.bullets) lines.push(`- ${b}`);
      lines.push("");
    }
  }

  if (type === "cost" || template?.sections?.includes("cost_snapshot")) {
    const c7 = data.usage7d?.totals?.estimatedCostUsd ?? 0;
    const c30 = data.usage30d?.totals?.estimatedCostUsd ?? 0;
    lines.push("## Cost", "", `- 7d: $${c7.toFixed(2)}`, `- 30d: $${c30.toFixed(2)}`, "");
    if (data.anomalies?.hasAnomalies) {
      lines.push("⚠️ Cost anomalies detected", "");
    }
  }

  if (data.failedRuns?.length) {
    lines.push("## Failed Runs", "");
    for (const r of data.failedRuns.slice(0, 5)) {
      lines.push(`- ${r.goal || r.id} (${r.status})`);
    }
    lines.push("");
  }

  if (data.pendingApprovals?.length) {
    lines.push("## Pending Approvals", "", `Count: ${data.pendingApprovals.length}`, "");
  }

  if (type === "agent_productivity") {
    lines.push("## Productivity", "", `- Success rate: ${data.successRate}%`, `- Total runs: ${data.runs.length}`, "");
  }

  if (data.commandCenter?.risks?.length) {
    lines.push("## Risks", "");
    for (const risk of data.commandCenter.risks.slice(0, 5)) {
      lines.push(`- [${risk.level}] ${risk.message}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

export async function generateBriefing({ type = "daily_engineering", projectId } = {}) {
  if (!projectId) throw Object.assign(new Error("projectId required"), { code: "invalid" });
  if (!REPORT_TEMPLATES[type]) {
    throw Object.assign(new Error(`Unknown report type: ${type}`), { code: "invalid_type" });
  }

  const data = await gatherReportData(projectId, type);
  const markdown = renderMarkdown(type, data, projectId);
  const template = REPORT_TEMPLATES[type];

  return saveBriefing({
    type,
    title: template.title,
    projectId,
    markdown,
    sections: {
      summary: data.briefing,
      stats: data.briefing?.stats,
      cost7d: data.usage7d?.totals,
      cost30d: data.usage30d?.totals,
      failedRunCount: data.failedRuns.length,
      pendingApprovalCount: data.pendingApprovals.length,
      successRate: data.successRate,
    },
  });
}

export async function deliverBriefing(briefingId, { channel = "native", target = null } = {}) {
  const briefing = getBriefingById(briefingId);
  if (!briefing) return { ok: false, error: { code: "not_found" } };

  const tool = getTool("notifications_send");
  if (!tool?.handler) {
    appendDeliveryLog(briefingId, { channel, status: "logged", message: "notifications_send unavailable — logged only" });
    return { ok: true, delivered: false, channel, fallback: "log", message: briefing.markdown.slice(0, 200) };
  }

  try {
    const result = await tool.handler({
      channel: channel === "slack" ? "auto" : channel,
      title: briefing.title,
      message: briefing.markdown.slice(0, 4000),
      target,
      explanation: "Deliver engineering briefing",
    });
    appendDeliveryLog(briefingId, { channel, status: result?.ok ? "sent" : "failed", result });
    return { ok: true, delivered: !!result?.ok, channel, result };
  } catch (err) {
    appendDeliveryLog(briefingId, { channel, status: "error", error: err.message });
    return { ok: false, error: { code: "delivery_failed", message: err.message } };
  }
}

export async function generateAndDeliverDailyBrief(projectId, { channel = "native" } = {}) {
  const briefing = await generateBriefing({ type: "daily_engineering", projectId });
  const delivery = await deliverBriefing(briefing.id, { channel });
  return { briefing, delivery };
}
