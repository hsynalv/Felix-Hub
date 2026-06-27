/**
 * V7 — Personal daily briefing schedule settings.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { config } from "../config.js";
import { getNextCronRun } from "../ops/cron-match.js";

const DEFAULT_STORE_PATH = join(config.catalog?.cacheDir || "./cache", "briefing-schedule.json");

const DEFAULTS = {
  enabled: false,
  cronExpr: "0 9 * * *",
  timezone: "Europe/Istanbul",
  pushTelegram: true,
  actionRequiredOnly: false,
  scope: "personal",
  lastRunAt: null,
  lastPushAt: null,
  lastFiredDate: null,
  nextRunAt: null,
};

function getStorePath() {
  return process.env.BRIEFING_SCHEDULE_PATH || DEFAULT_STORE_PATH;
}

function ensureStore() {
  const STORE_PATH = getStorePath();
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify(DEFAULTS, null, 2), "utf8");
  }
}

function readRaw() {
  ensureStore();
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(getStorePath(), "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeRaw(data) {
  ensureStore();
  writeFileSync(getStorePath(), JSON.stringify(data, null, 2), "utf8");
}

export function resetBriefingScheduleForTests() {
  writeRaw({ ...DEFAULTS });
}

export function getBriefingSchedule() {
  const s = readRaw();
  const nextRunAt =
    s.enabled && s.cronExpr
      ? getNextCronRun(s.cronExpr, new Date(), s.timezone || "UTC")?.toISOString() || null
      : null;
  return { ...s, nextRunAt };
}

export function updateBriefingSchedule(patch) {
  const current = readRaw();
  const next = {
    ...current,
    ...patch,
    cronExpr: patch.cronExpr ?? current.cronExpr ?? DEFAULTS.cronExpr,
    timezone: patch.timezone ?? current.timezone ?? DEFAULTS.timezone,
  };
  next.nextRunAt = next.enabled
    ? getNextCronRun(next.cronExpr, new Date(), next.timezone)?.toISOString() || null
    : null;
  writeRaw(next);
  return getBriefingSchedule();
}

/** @param {{ dateKey: string, pushed?: boolean }} meta */
export function recordBriefingScheduleRun(meta) {
  const current = readRaw();
  writeRaw({
    ...current,
    lastRunAt: new Date().toISOString(),
    lastFiredDate: meta.dateKey,
    lastPushAt: meta.pushed ? new Date().toISOString() : current.lastPushAt,
    nextRunAt: current.enabled
      ? getNextCronRun(current.cronExpr, new Date(), current.timezone)?.toISOString() || null
      : null,
  });
}

export function timeToCron(hour, minute) {
  const h = Math.max(0, Math.min(23, Number(hour)));
  const m = Math.max(0, Math.min(59, Number(minute)));
  return `${m} ${h} * * *`;
}

export function parseCronTime(cronExpr) {
  const parts = String(cronExpr || "").trim().split(/\s+/);
  if (parts.length !== 5) return { hour: 9, minute: 0 };
  return { minute: parseInt(parts[0], 10) || 0, hour: parseInt(parts[1], 10) || 9 };
}
