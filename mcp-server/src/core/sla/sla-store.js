/**
 * SLA policy persistence + violation log.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.SLA_POLICY_STORE || join(config.catalog?.cacheDir || "./cache", "sla-policies.json");

const DEFAULT_POLICY = {
  approvalTimeoutHours: 4,
  runFailureThreshold: 3,
  runFailureWindowHours: 24,
  costThresholdUsd: 100,
  actions: {
    approvalTimeout: { action: "notify_and_issue", target: "owner" },
    runFailure: { action: "pause_schedule", target: "schedule" },
    costExceeded: { action: "stop_run", target: "run" },
  },
};

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(
      STORE_PATH,
      JSON.stringify({ projects: {}, violations: [], failureStreaks: {}, escalatedApprovals: {} }, null, 2),
      "utf8"
    );
  }
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8"));
  } catch {
    return { projects: {}, violations: [], failureStreaks: {}, escalatedApprovals: {} };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

export function getSlaPolicy(projectId) {
  const store = readStore();
  return { ...DEFAULT_POLICY, ...(store.projects?.[projectId] || {}), projectId };
}

export function setSlaPolicy(projectId, patch) {
  const store = readStore();
  store.projects[projectId] = {
    ...getSlaPolicy(projectId),
    ...patch,
    projectId,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return store.projects[projectId];
}

export function recordViolation(entry) {
  const store = readStore();
  store.violations = store.violations || [];
  const violation = { id: randomUUID(), at: new Date().toISOString(), ...entry };
  store.violations.push(violation);
  if (store.violations.length > 1000) store.violations = store.violations.slice(-1000);
  writeStore(store);
  return violation;
}

export function listViolations({ projectId = null, limit = 50 } = {}) {
  let items = readStore().violations || [];
  if (projectId) items = items.filter((v) => v.projectId === projectId);
  return items.slice(-limit).reverse();
}

export function getFailureStreak(scheduleId) {
  return readStore().failureStreaks?.[scheduleId] || 0;
}

export function incrementFailureStreak(scheduleId) {
  const store = readStore();
  store.failureStreaks = store.failureStreaks || {};
  store.failureStreaks[scheduleId] = (store.failureStreaks[scheduleId] || 0) + 1;
  writeStore(store);
  return store.failureStreaks[scheduleId];
}

export function resetFailureStreak(scheduleId) {
  const store = readStore();
  if (store.failureStreaks?.[scheduleId]) {
    store.failureStreaks[scheduleId] = 0;
    writeStore(store);
  }
}

export function markApprovalEscalated(approvalId) {
  const store = readStore();
  store.escalatedApprovals = store.escalatedApprovals || {};
  store.escalatedApprovals[approvalId] = new Date().toISOString();
  writeStore(store);
}

export function isApprovalEscalated(approvalId) {
  return !!readStore().escalatedApprovals?.[approvalId];
}

export function resetSlaForTests() {
  writeStore({ projects: {}, violations: [], failureStreaks: {}, escalatedApprovals: {} });
}
