/**
 * Watcher event matching and autonomous run dispatch (V6.3).
 */

import {
  listWatchers,
  getWatcherById,
  recordWatcherFire,
} from "./watcher-store.js";
import { createParentRun, spawnChildRun } from "./multi-agent.service.js";
import { runSkillMultiAgent } from "./skill.service.js";
import { getTrustScore } from "./trust.service.js";

const SEVERITY_RANK = { debug: 0, info: 1, warning: 2, warn: 2, error: 3, critical: 4, fatal: 5 };

function severityMeets(minSeverity, actual) {
  if (!minSeverity) return true;
  const min = SEVERITY_RANK[String(minSeverity).toLowerCase()] ?? 0;
  const act = SEVERITY_RANK[String(actual || "info").toLowerCase()] ?? 1;
  return act >= min;
}

function isInCooldown(watcher) {
  if (!watcher.lastFiredAt || !watcher.cooldownMinutes) return false;
  const last = new Date(watcher.lastFiredAt).getTime();
  const cooldownMs = watcher.cooldownMinutes * 60 * 1000;
  return Date.now() - last < cooldownMs;
}

export function matchesWatcher(watcher, event) {
  if (!watcher.enabled) return false;
  if (watcher.projectId && event.projectId && watcher.projectId !== event.projectId) return false;
  if (watcher.source && watcher.source !== "*" && watcher.source !== event.source) return false;

  const types = watcher.eventTypes || ["*"];
  if (!types.includes("*") && event.eventType && !types.includes(event.eventType)) return false;

  if (!severityMeets(watcher.minSeverity, event.severity)) return false;
  return true;
}

async function fireWatcher(watcher, event) {
  const params = {
    ...watcher.parameters,
    message: event.message,
    severity: event.severity,
    eventType: event.eventType,
    source: event.source,
    payload: event.payload,
  };

  let runId = null;
  let outcome = "spawned";

  try {
    if (watcher.skillId) {
      const result = await runSkillMultiAgent(watcher.skillId, params, {
        projectId: watcher.projectId || event.projectId,
        createdBy: "watcher",
        dryRun: watcher.dryRun,
      });
      runId = result.child?.id || result.children?.[0]?.id || result.parent?.id || null;
    } else {
      const parent = await createParentRun({
        goal: `Watcher: ${watcher.name}`,
        projectId: watcher.projectId || event.projectId,
        createdBy: "watcher",
        metadata: { watcherId: watcher.id, trigger: event },
      });
      const child = await spawnChildRun(parent.id, {
        role: watcher.role,
        templateId: watcher.templateId,
        parameters: params,
        projectId: watcher.projectId || event.projectId,
        createdBy: "watcher",
        dryRun: watcher.dryRun,
      });
      runId = child.id;
    }
  } catch (err) {
    outcome = "failed";
    recordWatcherFire(watcher.id, {
      outcome,
      error: err.message,
      event,
    });
    return { watcherId: watcher.id, outcome, error: err.message };
  }

  recordWatcherFire(watcher.id, { outcome, runId, event });
  return { watcherId: watcher.id, outcome, runId };
}

export async function dispatchWatcherEvent(event) {
  const normalized = {
    source: event.source || "generic",
    eventType: event.eventType || event.type || "signal",
    severity: event.severity || "error",
    message: event.message || "Watcher event",
    projectId: event.projectId || null,
    payload: event.payload || {},
  };

  const watchers = listWatchers({ enabled: true, projectId: normalized.projectId });
  const results = [];

  for (const watcher of watchers) {
    if (!matchesWatcher(watcher, normalized)) continue;
    if (isInCooldown(watcher)) {
      results.push({ watcherId: watcher.id, outcome: "skipped", reason: "cooldown" });
      continue;
    }

    const entityId = watcher.skillId || watcher.templateId;
    const entityType = watcher.skillId ? "skill" : "template";
    const trust = getTrustScore(entityType, entityId);
    if (watcher.minTrustScore > 0 && trust.score < watcher.minTrustScore) {
      results.push({
        watcherId: watcher.id,
        outcome: "blocked",
        reason: "trust_score",
        trustScore: trust.score,
      });
      recordWatcherFire(watcher.id, { outcome: "blocked", reason: "trust_score", event: normalized });
      continue;
    }

    results.push(await fireWatcher(watcher, normalized));
  }

  return { event: normalized, results, fired: results.filter((r) => r.outcome === "spawned").length };
}

export async function testFireWatcher(watcherId, event = {}) {
  const watcher = getWatcherById(watcherId);
  if (!watcher) {
    throw Object.assign(new Error(`Watcher not found: ${watcherId}`), { code: "not_found" });
  }
  return fireWatcher(watcher, {
    source: event.source || watcher.source,
    eventType: event.eventType || "test",
    severity: event.severity || "error",
    message: event.message || `Test fire: ${watcher.name}`,
    projectId: event.projectId || watcher.projectId,
    payload: event.payload || { test: true },
  });
}
