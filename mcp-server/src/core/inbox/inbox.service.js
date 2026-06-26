/**
 * Unified agent inbox — approvals, runs, SLA, watchers (V6.6).
 */

import { getApprovalStore } from "../policy-hooks.js";
import { listRuns } from "../agent-runs/agent-runs.service.js";
import { listViolations } from "../sla/sla-store.js";
import { listWatcherHistory } from "../v6/watcher-store.js";
import { getInboxItemState } from "./inbox-store.js";

const PRIORITY_ORDER = { critical: 0, high: 1, normal: 2, low: 3 };

function isSnoozed(state) {
  if (!state?.snoozedUntil) return false;
  return new Date(state.snoozedUntil).getTime() > Date.now();
}

function baseItem({ id, type, priority, title, message, runId, projectId, createdAt, payload, actions }) {
  const state = getInboxItemState(id);
  return {
    id,
    type,
    priority: priority || "normal",
    title,
    message: message || "",
    runId: runId || null,
    projectId: projectId || null,
    createdAt: createdAt || new Date().toISOString(),
    payload: payload || {},
    actions: actions || ["open"],
    readAt: state?.readAt || null,
    snoozedUntil: state?.snoozedUntil || null,
    unread: !state?.readAt,
    snoozed: isSnoozed(state),
  };
}

function approvalItems() {
  const store = getApprovalStore();
  if (!store?.listApprovals) return [];
  return store
    .listApprovals({ status: "pending" })
    .map((a) =>
      baseItem({
        id: `approval:${a.id}`,
        type: "approval",
        priority: (a.riskScore ?? 0) >= 70 ? "high" : "normal",
        title: `Onay: ${a.toolName || a.path || "tool"}`,
        message: a.explanation || "Agent onay bekliyor",
        runId: a.runId,
        createdAt: a.createdAt,
        payload: { approvalId: a.id, toolName: a.toolName, riskScore: a.riskScore },
        actions: ["approve", "deny", "open"],
      })
    );
}

async function runItems({ projectId } = {}) {
  const items = [];
  const statuses = [
    { status: "failed", type: "run_failed", priority: "high", titlePrefix: "Run başarısız" },
    { status: "waiting_approval", type: "run_waiting", priority: "high", titlePrefix: "Run onay bekliyor" },
    { status: "running", type: "run_active", priority: "low", titlePrefix: "Run devam ediyor" },
  ];

  for (const spec of statuses) {
    const runs = await listRuns({ status: spec.status, projectId, limit: 30 });
    for (const run of runs) {
      if (spec.status === "running" && run.metadata?.multiAgent && run.metadata?.runKind === "parent") {
        continue;
      }
      items.push(
        baseItem({
          id: `run:${run.id}`,
          type: spec.type,
          priority: spec.priority,
          title: `${spec.titlePrefix}: ${run.goal || run.id.slice(0, 8)}`,
          message: run.error?.message || run.status,
          runId: run.id,
          projectId: run.projectId,
          createdAt: run.updatedAt || run.createdAt,
          payload: { status: run.status, templateId: run.metadata?.templateId },
          actions: ["open_run"],
        })
      );
    }
  }
  return items;
}

function slaItems({ projectId } = {}) {
  return listViolations({ projectId, limit: 30 }).map((v) =>
    baseItem({
      id: `sla:${v.id || `${v.rule}-${v.at}`}`,
      type: "sla_violation",
      priority: v.severity === "critical" ? "critical" : "high",
      title: `SLA ihlali: ${v.rule || "policy"}`,
      message: v.message || v.detail || "SLA eşiği aşıldı",
      runId: v.runId || null,
      projectId: v.projectId || projectId,
      createdAt: v.at || v.createdAt,
      payload: v,
      actions: ["open", "snooze"],
    })
  );
}

function watcherItems() {
  return listWatcherHistory({ limit: 40 })
    .filter((e) => ["blocked", "failed", "spawned"].includes(e.outcome))
    .map((e) =>
      baseItem({
        id: `watcher:${e.id}`,
        type: e.outcome === "spawned" ? "watcher_fired" : "watcher_alert",
        priority: e.outcome === "failed" ? "high" : e.outcome === "blocked" ? "normal" : "low",
        title:
          e.outcome === "spawned"
            ? `Watcher tetiklendi`
            : e.outcome === "blocked"
              ? "Watcher trust skoru engelledi"
              : "Watcher başarısız",
        message: e.event?.message || e.error || e.reason || e.outcome,
        runId: e.runId || null,
        createdAt: e.at,
        payload: { watcherId: e.watcherId, outcome: e.outcome },
        actions: ["open_run", "snooze"],
      })
    );
}

export async function listInboxItems({
  projectId = null,
  types = null,
  includeSnoozed = false,
  includeRead = true,
  limit = 100,
} = {}) {
  let items = [
    ...approvalItems(),
    ...(await runItems({ projectId })),
    ...slaItems({ projectId }),
    ...watcherItems(),
  ];

  if (projectId) {
    items = items.filter((i) => !i.projectId || i.projectId === projectId);
  }
  if (types?.length) {
    const set = new Set(types);
    items = items.filter((i) => set.has(i.type));
  }
  if (!includeSnoozed) items = items.filter((i) => !i.snoozed);
  if (!includeRead) items = items.filter((i) => i.unread);

  items.sort((a, b) => {
    const pd = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    if (pd !== 0) return pd;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const unreadCount = items.filter((i) => i.unread && !i.snoozed).length;
  return { items: items.slice(0, limit), count: items.length, unreadCount };
}

export async function getInboxSummary({ projectId } = {}) {
  const { items, unreadCount } = await listInboxItems({ projectId, limit: 500 });
  const byType = {};
  for (const item of items) {
    byType[item.type] = (byType[item.type] || 0) + 1;
  }
  return { total: items.length, unreadCount, byType };
}
