/**
 * V7 — Daily personal briefing generation.
 */

import { buildPersonalBriefing } from "./personal-briefing.service.js";
import { listInboxItems } from "../inbox/inbox.service.js";
import { listRuns } from "../agent-runs/agent-runs.service.js";
import { listProjects } from "../../plugins/projects/projects.store.js";
import { listPreferences } from "../v6-c/operating-model-store.js";
import { listBriefingSources } from "./briefing-sources.js";
import { saveBriefing, getLatestBriefing } from "./briefing-store.js";
import { applyBriefingFeedbackToItems } from "./briefing-feedback.service.js";
import { collectExternalBriefingItems } from "./briefing-connectors.service.js";

function scoreItem(priority, type) {
  const base = { critical: 90, high: 70, normal: 40, low: 20 }[priority] || 30;
  const typeBoost = {
    approval: 15,
    run_failed: 12,
    sla_violation: 10,
    run_waiting: 8,
  }[type] || 0;
  return base + typeBoost;
}

/**
 * @param {{ scope?: string, projectId?: string|null, persist?: boolean }} opts
 */
export async function generateDailyBriefing({ scope = "personal", projectId = null, persist = true } = {}) {
  const core = await buildPersonalBriefing({ scope, projectId });
  const inbox = await listInboxItems({
    projectId: scope === "project" ? projectId : null,
    includeRead: false,
    limit: 20,
  });
  const runs = await listRuns({ projectId: projectId || undefined, limit: 15 });
  const projects = listProjects();
  const pinned = listPreferences().filter((p) => p.pinned);

  const items = [];

  for (const item of inbox.items) {
    items.push({
      id: item.id,
      source: "hub_inbox",
      title: item.title,
      body: item.message,
      importance: scoreItem(item.priority, item.type),
      actionRequired: item.type === "approval" || item.type === "run_failed",
      href: item.type === "approval" ? "/approvals" : item.runId ? `/runs?highlight=${item.runId}` : "/inbox",
      createdAt: item.createdAt,
    });
  }

  for (const run of runs.filter((r) => ["running", "waiting_approval", "failed"].includes(r.status)).slice(0, 8)) {
    items.push({
      id: `run:${run.id}`,
      source: "hub_runs",
      title: `Run ${run.status}: ${run.goal || run.id.slice(0, 8)}`,
      body: run.error?.message || run.status,
      importance: run.status === "failed" ? 85 : run.status === "waiting_approval" ? 75 : 35,
      actionRequired: run.status !== "running",
      href: `/runs?highlight=${run.id}`,
      createdAt: run.updatedAt || run.createdAt,
    });
  }

  if (projects.length) {
    items.push({
      id: "projects-summary",
      source: "hub_projects",
      title: `${projects.length} aktif proje`,
      body: projects
        .slice(0, 5)
        .map((p) => p.name || p.key)
        .join(", "),
      importance: 25,
      actionRequired: false,
      href: "/projects",
      createdAt: new Date().toISOString(),
    });
  }

  for (const pref of pinned) {
    items.push({
      id: `pref:${pref.id}`,
      source: "hub_memory",
      title: `Tercih: ${pref.key}`,
      body: String(pref.value).slice(0, 200),
      importance: 30,
      actionRequired: false,
      href: "/v6",
      createdAt: pref.updatedAt,
    });
  }

  const external = await collectExternalBriefingItems({ skipImap: process.env.BRIEFING_SKIP_IMAP === "true" });
  items.push(...external.items);

  const ranked = applyBriefingFeedbackToItems(items);

  const record = {
    date: core.date,
    scope,
    summary: core.summary,
    items: ranked.slice(0, 20),
    stats: core.stats,
    sources: listBriefingSources(),
    externalErrors: external.errors,
    generatedAt: new Date().toISOString(),
  };

  if (persist) return saveBriefing(record);
  return { ...record, id: "preview" };
}

export function getTodayBriefingRecord(opts = {}) {
  return getLatestBriefing(opts);
}
