/**
 * V7 — Personal Command Center BFF.
 */

import { getTodayBriefingRecord } from "./daily-briefing.service.js";
import { buildPersonalBriefing } from "./personal-briefing.service.js";
import { listInboxItems, getInboxSummary } from "../inbox/inbox.service.js";
import { listRuns } from "../agent-runs/agent-runs.service.js";
import { getApprovalStore } from "../policy-hooks.js";
import { listProjects } from "../../plugins/projects/projects.store.js";
import { queryStats } from "../usage/usage-ledger.service.js";
import { listPreferences } from "../v6-c/operating-model-store.js";
import { getTodayBriefing } from "../project-context/command-center.service.js";
import { getPersonalDesktopStatus } from "./personal-desktop.service.js";
import { getPersonalAutonomyState } from "./personal-autonomy.service.js";
import { getOpsDashboard } from "./personal-ops.service.js";

const STALE_RUN_MS = 60 * 60 * 1000;

function buildSuggestedActions({ inboxItems, approvals, runs, briefing }) {
  const actions = [];

  const pendingApprovals = approvals?.length ?? inboxItems.filter((i) => i.type === "approval").length;
  if (pendingApprovals > 0) {
    actions.push({
      id: "review-approvals",
      priority: "high",
      title: `${pendingApprovals} onay bekliyor`,
      message: "Agent yazma veya riskli işlem için onayınız gerekiyor.",
      href: "/approvals",
      kind: "approval",
    });
  }

  const unreadHigh = inboxItems.filter(
    (i) => i.unread && !i.snoozed && (i.priority === "critical" || i.priority === "high")
  );
  if (unreadHigh.length) {
    actions.push({
      id: "inbox-urgent",
      priority: "high",
      title: `${unreadHigh.length} acil inbox öğesi`,
      message: "Onay, başarısız run veya SLA uyarıları inbox'ta.",
      href: "/inbox",
      kind: "inbox",
    });
  }

  const now = Date.now();
  const staleRuns = runs.filter(
    (r) =>
      r.status === "running" &&
      r.startedAt &&
      now - new Date(r.startedAt).getTime() > STALE_RUN_MS
  );
  if (staleRuns.length) {
    actions.push({
      id: "stale-runs",
      priority: "normal",
      title: `${staleRuns.length} uzun süren run`,
      message: "1 saatten uzun süredir çalışan agent run'ları kontrol edin.",
      href: "/runs",
      kind: "run",
    });
  }

  const failed = runs.filter((r) => r.status === "failed" || r.status === "error");
  if (failed.length) {
    actions.push({
      id: "failed-runs",
      priority: "high",
      title: `${failed.length} başarısız run`,
      message: "Son başarısız agent çalışmalarını inceleyin.",
      href: "/runs",
      kind: "run",
    });
  }

  if ((briefing?.stats?.unreadInbox ?? 0) === 0 && pendingApprovals === 0 && !failed.length) {
    actions.push({
      id: "daily-check",
      priority: "low",
      title: "Günlük brifing hazır",
      message: briefing?.summary || "Bugün için özet görüntülendi.",
      href: "/",
      kind: "briefing",
    });
  }

  return actions.slice(0, 8);
}

/**
 * @param {{ projectId?: string|null, scope?: "personal"|"project", projectKey?: string }} opts
 */
export async function getPersonalCommandCenter({
  projectId = null,
  scope = "personal",
  projectKey = null,
} = {}) {
  const effectiveProject = scope === "project" ? projectKey || projectId : null;

  const [briefing, inboxFeed, inboxSummary, runs, usage, preferences, dailyBriefing, desktopStatus, autonomy, ops] =
    await Promise.all([
    buildPersonalBriefing({ projectId: effectiveProject, scope }),
    listInboxItems({
      projectId: effectiveProject,
      includeRead: false,
      includeSnoozed: false,
      limit: 8,
    }),
    getInboxSummary({ projectId: effectiveProject }),
    listRuns({ projectId: effectiveProject || undefined, limit: 20 }),
    queryStats({ days: 7 }).catch(() => null),
    Promise.resolve(listPreferences().slice(0, 8)),
    Promise.resolve(getTodayBriefingRecord({ scope })),
    getPersonalDesktopStatus().catch(() => ({ sidecar: { paired: false } })),
    Promise.resolve(getPersonalAutonomyState()),
    Promise.resolve(getOpsDashboard()),
  ]);

  const approvalStore = getApprovalStore();
  const approvals =
    approvalStore?.listApprovals?.({ status: "pending" })?.slice(0, 8) ?? [];

  const activeRuns = runs
    .filter((r) => r.status === "running" || r.status === "waiting_approval")
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      goal: r.goal,
      status: r.status,
      projectId: r.projectId,
      startedAt: r.startedAt || r.createdAt,
      updatedAt: r.updatedAt,
    }));

  const projects = listProjects().slice(0, 12).map((p) => ({
    key: p.key,
    name: p.name,
    envCount: p.envs?.length ?? 0,
  }));

  let projectSnapshots = [];
  if (effectiveProject) {
    try {
      const cc = await getTodayBriefing(effectiveProject);
      projectSnapshots = [
        {
          key: effectiveProject,
          briefing: cc.briefing,
          stats: cc.briefing?.stats,
        },
      ];
    } catch {
      projectSnapshots = [];
    }
  }

  const suggestedActions = buildSuggestedActions({
    inboxItems: inboxFeed.items,
    approvals,
    runs,
    briefing,
  });

  return {
    scope,
    projectId: effectiveProject,
    generatedAt: new Date().toISOString(),
    today: briefing,
    dailyBriefing,
    inbox: {
      summary: inboxSummary,
      items: inboxFeed.items,
    },
    approvals: approvals.map((a) => ({
      id: a.id,
      toolName: a.toolName,
      explanation: a.explanation,
      riskScore: a.riskScore,
      runId: a.runId,
      createdAt: a.createdAt,
    })),
    activeRuns,
    projects,
    projectSnapshots,
    usage: usage
      ? {
          days: 7,
          totalCostUsd: usage.estimatedCostUsd ?? 0,
          totalTokens: usage.totalTokens ?? 0,
          eventCount: usage.callCount ?? 0,
        }
      : null,
    memory: {
      preferences: preferences.map((p) => ({
        id: p.id,
        key: p.key,
        value: p.value,
        pinned: p.pinned,
        scope: p.scope,
      })),
    },
    mail: { status: "not_configured", items: [], hint: "V7.2 — IMAP/Gmail bağlayın" },
    news: { status: "not_configured", items: [], hint: "V7.2 — RSS/haber kaynakları" },
    telegram: {
      status: "mvp_done",
      hint: "/brief, /runs, /desktop, /file, onay komutları aktif",
    },
    desktop: desktopStatus,
    autonomy,
    ops: {
      emergencyStop: ops.emergencyStop,
      hubPaused: ops.hubPaused,
      maxDailySpendUsd: ops.maxDailySpendUsd,
      desktopActionsToday: ops.counters?.desktopActions ?? 0,
    },
    suggestedActions,
  };
}
