/**
 * V7 — Personal ops limits + daily counters.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.PERSONAL_OPS_STORE || join(config.catalog?.cacheDir || "./cache", "personal-ops.json");

/** @type {object | null} */
let memoryStore = null;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function defaultConfig() {
  return {
    maxDailySpendUsd: 5,
    maxDesktopActionsPerRun: 20,
    maxDesktopActionsPerDay: 100,
    promptInjectionGuard: true,
    secretRedaction: true,
    paymentProtection: true,
    emergencyStopUntil: null,
    emergencyStopReason: null,
    counters: {
      date: todayKey(),
      desktopActions: 0,
      spendUsd: 0,
      runDesktopActions: {},
    },
    updatedAt: new Date().toISOString(),
  };
}

function ensureFile() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readFileStore() {
  ensureFile();
  if (!existsSync(STORE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function persist(data) {
  memoryStore = data;
  try {
    ensureFile();
    writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch {
    /* optional in tests */
  }
}

function rollCounters(store) {
  const key = todayKey();
  if (store.counters?.date !== key) {
    store.counters = { date: key, desktopActions: 0, spendUsd: 0, runDesktopActions: {} };
  }
  return store;
}

export function getPersonalOpsState() {
  const base = memoryStore || readFileStore() || defaultConfig();
  return rollCounters({ ...defaultConfig(), ...base });
}

export function updatePersonalOpsConfig(patch = {}) {
  const current = getPersonalOpsState();
  const next = rollCounters({
    ...current,
    ...patch,
    counters: { ...current.counters, ...(patch.counters || {}) },
    updatedAt: new Date().toISOString(),
  });
  persist(next);
  return next;
}

export function setEmergencyStop({ until, reason = "manual" } = {}) {
  return updatePersonalOpsConfig({
    emergencyStopUntil: until,
    emergencyStopReason: reason,
  });
}

export function clearEmergencyStop() {
  return updatePersonalOpsConfig({
    emergencyStopUntil: null,
    emergencyStopReason: null,
  });
}

export function isEmergencyStopActive() {
  const state = getPersonalOpsState();
  if (!state.emergencyStopUntil) return false;
  if (new Date(state.emergencyStopUntil).getTime() <= Date.now()) {
    clearEmergencyStop();
    return false;
  }
  return true;
}

export function recordDesktopAction({ runId = null } = {}) {
  const state = getPersonalOpsState();
  state.counters.desktopActions += 1;
  if (runId) {
    state.counters.runDesktopActions[runId] = (state.counters.runDesktopActions[runId] || 0) + 1;
  }
  persist(state);
  return state.counters;
}

export function recordSpendUsd(amount) {
  const state = getPersonalOpsState();
  state.counters.spendUsd += Number(amount) || 0;
  persist(state);
  return state.counters;
}

/** @internal */
export function resetPersonalOpsStoreForTests() {
  memoryStore = null;
}
