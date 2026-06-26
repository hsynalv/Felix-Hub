/**
 * Agent schedule persistence.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { config } from "../config.js";
import { getNextCronRun } from "./cron-match.js";
import { validateSchedulePolicy } from "./schedule-policy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.SCHEDULE_STORE || join(config.catalog?.cacheDir || "./cache", "agent-schedules.json");

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ schedules: [], history: [] }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return {
      schedules: Array.isArray(raw.schedules) ? raw.schedules : [],
      history: Array.isArray(raw.history) ? raw.history : [],
    };
  } catch {
    return { schedules: [], history: [] };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

function normalizeSchedule(s) {
  return {
    id: s.id,
    name: s.name,
    runbookId: s.runbookId || null,
    templateId: s.templateId || null,
    reportType: s.reportType || null,
    cronExpr: s.cronExpr,
    timezone: s.timezone || "UTC",
    projectId: s.projectId || null,
    projectEnv: s.projectEnv || "development",
    maxCostUsd: s.maxCostUsd ?? 5,
    allowedTools: Array.isArray(s.allowedTools) ? s.allowedTools : [],
    autonomyLevel: s.autonomyLevel || "L4",
    notifyTarget: s.notifyTarget || null,
    skipIf: s.skipIf || null,
    parameters: s.parameters || {},
    enabled: s.enabled !== false,
    paused: !!s.paused,
    lastRunAt: s.lastRunAt || null,
    nextRunAt: s.nextRunAt || null,
    lastRunId: s.lastRunId || null,
    lastOutcome: s.lastOutcome || null,
    createdAt: s.createdAt || new Date().toISOString(),
    updatedAt: s.updatedAt || new Date().toISOString(),
  };
}

function computeNextRun(schedule) {
  if (!schedule.cronExpr || schedule.paused || !schedule.enabled) return null;
  const next = getNextCronRun(schedule.cronExpr, new Date(), schedule.timezone || "UTC");
  return next ? next.toISOString() : null;
}

export function listSchedules({ projectId = null } = {}) {
  const items = readStore().schedules.map((s) => {
    const norm = normalizeSchedule(s);
    return { ...norm, nextRunAt: norm.nextRunAt || computeNextRun(norm) };
  });
  if (!projectId) return items;
  return items.filter((s) => !s.projectId || s.projectId === projectId);
}

export function getScheduleById(id) {
  const s = readStore().schedules.find((x) => x.id === id);
  if (!s) return null;
  const norm = normalizeSchedule(s);
  return { ...norm, nextRunAt: norm.nextRunAt || computeNextRun(norm) };
}

export function createSchedule(input) {
  if (!input.runbookId && !input.templateId && !input.reportType) {
    throw Object.assign(new Error("runbookId, templateId, or reportType required"), { code: "invalid" });
  }
  if (!input.cronExpr) {
    throw Object.assign(new Error("cronExpr required"), { code: "invalid" });
  }

  validateSchedulePolicy(input, { projectId: input.projectId || null });

  const now = new Date().toISOString();
  const schedule = normalizeSchedule({
    ...input,
    id: input.id || `sched-${randomUUID().slice(0, 8)}`,
    createdAt: now,
    updatedAt: now,
    paused: false,
  });
  schedule.nextRunAt = computeNextRun(schedule);

  const store = readStore();
  store.schedules.push(schedule);
  writeStore(store);
  return schedule;
}

export function updateSchedule(id, patch) {
  const store = readStore();
  const idx = store.schedules.findIndex((s) => s.id === id);
  if (idx < 0) return null;

  const updated = normalizeSchedule({
    ...store.schedules[idx],
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  });
  updated.nextRunAt = computeNextRun(updated);
  store.schedules[idx] = updated;
  writeStore(store);
  return updated;
}

export function deleteSchedule(id) {
  const store = readStore();
  const before = store.schedules.length;
  store.schedules = store.schedules.filter((s) => s.id !== id);
  if (store.schedules.length === before) return false;
  writeStore(store);
  return true;
}

export function pauseSchedule(id, paused = true) {
  return updateSchedule(id, { paused });
}

export function recordScheduleFire(scheduleId, entry) {
  const store = readStore();
  store.history = store.history || [];
  store.history.push({
    id: randomUUID(),
    scheduleId,
    at: new Date().toISOString(),
    ...entry,
  });
  if (store.history.length > 2000) store.history = store.history.slice(-2000);

  const idx = store.schedules.findIndex((s) => s.id === scheduleId);
  if (idx >= 0) {
    store.schedules[idx].lastRunAt = entry.at || new Date().toISOString();
    store.schedules[idx].lastRunId = entry.runId || null;
    store.schedules[idx].lastOutcome = entry.outcome || null;
    store.schedules[idx].nextRunAt = computeNextRun(store.schedules[idx]);
    store.schedules[idx].updatedAt = new Date().toISOString();
  }
  writeStore(store);
}

export function listScheduleHistory({ scheduleId = null, limit = 50 } = {}) {
  let entries = readStore().history || [];
  if (scheduleId) entries = entries.filter((e) => e.scheduleId === scheduleId);
  return entries.slice(-limit).reverse();
}

export function resetSchedulesForTests() {
  writeStore({ schedules: [], history: [] });
}
