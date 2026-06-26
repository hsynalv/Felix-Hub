/**
 * Project Command Center — aggregated BFF for project ops dashboard.
 */

import { getProjectContext, getProjectChanges, getProjectLinks, listContextEvents } from "./project-context.service.js";
import { listRuns } from "../agent-runs/agent-runs.service.js";
import { queryProjectUsage } from "../usage/usage-ledger.service.js";
import { getApprovalStore } from "../policy-hooks.js";
import { checkQuota } from "../usage/quota.service.js";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isToday(iso) {
  if (!iso) return false;
  return new Date(iso) >= startOfToday();
}

function buildIntegrations(links) {
  if (!links) return [];
  const items = [];
  const add = (id, label, connected) => {
    if (connected) items.push({ id, label, connected: true });
  };
  add("github", links.githubRepo || "GitHub", Boolean(links.githubRepo));
  add("notion", "Notion", Boolean(links.notionProjectId));
  add("obsidian", "Obsidian", Boolean(links.obsidianVaultPath));
  if (links.backendRepo) add("backend_repo", links.backendRepo, true);
  if (links.frontendRepo) add("frontend_repo", links.frontendRepo, true);
  if (links.websiteUrl) add("website", links.websiteUrl, true);
  return items;
}

function buildRisks({ recentRuns, pendingApprovals, quotaCheck }) {
  const risks = [];
  for (const run of recentRuns.filter((r) => r.status === "failed" || r.status === "error")) {
    risks.push({
      level: "high",
      type: "failed_run",
      message: run.goal || run.id,
      runId: run.id,
    });
  }
  for (const a of pendingApprovals.filter((x) => (x.riskScore ?? 0) >= 70)) {
    risks.push({
      level: "medium",
      type: "pending_approval",
      message: a.toolName || a.path || a.id,
      approvalId: a.id,
      runId: a.runId,
    });
  }
  if (quotaCheck?.warning) {
    risks.push({
      level: "medium",
      type: "quota_warning",
      message: "Proje kullanım kotasına yaklaşılıyor",
    });
  }
  return risks;
}

/** "Bugün bu projede ne oldu?" özeti */
export async function getTodayBriefing(projectKey) {
  const sinceDays = 1;
  const events = await listContextEvents(projectKey, { limit: 200, sinceDays });
  const todayEvents = events.filter((e) => isToday(e.occurredAt));
  const runs = await listRuns({ projectId: projectKey, limit: 100 });
  const todayRuns = runs.filter((r) => isToday(r.startedAt || r.createdAt));

  const bullets = [];
  for (const ev of todayEvents.slice(0, 8)) {
    if (ev.summary) bullets.push(`${ev.eventType}: ${ev.summary}`);
    else bullets.push(ev.eventType);
  }
  for (const run of todayRuns.slice(0, 5)) {
    bullets.push(`Run ${run.status}: ${run.goal || run.id.slice(0, 8)}`);
  }

  const completed = todayRuns.filter((r) => r.status === "completed").length;
  const failed = todayRuns.filter((r) => r.status === "failed" || r.status === "error").length;

  let summary;
  if (bullets.length === 0) {
    summary = "Bugün bu projede kayıtlı aktivite yok.";
  } else {
    summary = `${todayEvents.length} olay, ${todayRuns.length} run (${completed} tamamlandı${failed ? `, ${failed} başarısız` : ""}).`;
  }

  return {
    date: startOfToday().toISOString().slice(0, 10),
    summary,
    bullets,
    stats: {
      events: todayEvents.length,
      runs: todayRuns.length,
      completedRuns: completed,
      failedRuns: failed,
    },
  };
}

/** Aggregated command center payload for a project. */
export async function getCommandCenter(projectKey) {
  const ctx = await getProjectContext(projectKey);
  const links = getProjectLinks(projectKey);
  const briefing = await getTodayBriefing(projectKey);
  const changes = await getProjectChanges(projectKey, { sinceDays: 14 });
  const usage7d = await queryProjectUsage(projectKey, { days: 7 });
  const usage30d = await queryProjectUsage(projectKey, { days: 30 });

  const store = getApprovalStore();
  const allPending = store?.listApprovals ? store.listApprovals({ status: "pending" }) : [];
  const projectRunIds = new Set((ctx.recentRuns || []).map((r) => r.id));
  const pendingApprovals = allPending.filter((a) => !a.runId || projectRunIds.has(a.runId));

  let quotaCheck = null;
  try {
    quotaCheck = await checkQuota(projectKey);
  } catch {
    quotaCheck = null;
  }

  const githubEvents = (ctx.recentEvents || []).filter((e) =>
    String(e.eventType || "").startsWith("github_")
  );
  const notionObsidianEvents = (ctx.recentEvents || []).filter((e) =>
    ["notion_note", "obsidian_note", "index_sync"].includes(e.eventType)
  );

  const risks = buildRisks({
    recentRuns: ctx.recentRuns || [],
    pendingApprovals,
    quotaCheck,
  });

  return {
    project: ctx.project,
    links,
    briefing,
    lastChangeSummary: ctx.lastChangeSummary,
    recentRuns: ctx.recentRuns,
    recentEvents: ctx.recentEvents,
    githubActivity: githubEvents.slice(0, 10),
    knowledgeActivity: notionObsidianEvents.slice(0, 10),
    integrations: buildIntegrations(links),
    usage: {
      last7Days: usage7d.totals,
      last30Days: usage30d.totals,
    },
    quota: quotaCheck
      ? {
          allowed: quotaCheck.allowed,
          warning: quotaCheck.warning ?? false,
          usage: quotaCheck.usage,
          quota: quotaCheck.quota,
        }
      : null,
    pendingApprovals: pendingApprovals.map((a) => ({
      id: a.id,
      toolName: a.toolName,
      riskScore: a.riskScore,
      runId: a.runId,
      createdAt: a.createdAt,
      explanation: a.explanation,
    })),
    risks,
    changesSummary: changes.summary,
    graph: ctx.graph,
  };
}
