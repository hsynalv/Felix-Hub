/**
 * Autonomous watcher persistence (V6.3).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.WATCHER_STORE || join(config.catalog?.cacheDir || "./cache", "agent-watchers.json");

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ watchers: [], history: [] }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return {
      watchers: Array.isArray(raw.watchers) ? raw.watchers : [],
      history: Array.isArray(raw.history) ? raw.history : [],
    };
  } catch {
    return { watchers: [], history: [] };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

function normalizeWatcher(w) {
  return {
    id: w.id,
    name: w.name,
    description: w.description || "",
    source: w.source || "generic",
    eventTypes: Array.isArray(w.eventTypes) ? w.eventTypes : ["*"],
    minSeverity: w.minSeverity || null,
    skillId: w.skillId || null,
    templateId: w.templateId || null,
    role: w.role || "executor",
    projectId: w.projectId || null,
    minTrustScore: w.minTrustScore ?? 0,
    cooldownMinutes: w.cooldownMinutes ?? 15,
    parameters: w.parameters || {},
    dryRun: !!w.dryRun,
    enabled: w.enabled !== false,
    lastFiredAt: w.lastFiredAt || null,
    lastRunId: w.lastRunId || null,
    lastOutcome: w.lastOutcome || null,
    createdAt: w.createdAt || new Date().toISOString(),
    updatedAt: w.updatedAt || new Date().toISOString(),
  };
}

export function listWatchers({ projectId = null, enabled = null } = {}) {
  let items = readStore().watchers.map(normalizeWatcher);
  if (projectId) items = items.filter((w) => !w.projectId || w.projectId === projectId);
  if (enabled === true) items = items.filter((w) => w.enabled);
  if (enabled === false) items = items.filter((w) => !w.enabled);
  return items;
}

export function getWatcherById(id) {
  const w = readStore().watchers.find((x) => x.id === id);
  return w ? normalizeWatcher(w) : null;
}

export function createWatcher(input) {
  if (!input.name) {
    throw Object.assign(new Error("name required"), { code: "invalid" });
  }
  if (!input.skillId && !input.templateId) {
    throw Object.assign(new Error("skillId or templateId required"), { code: "invalid" });
  }
  const now = new Date().toISOString();
  const watcher = normalizeWatcher({
    ...input,
    id: input.id || `watch-${randomUUID().slice(0, 8)}`,
    createdAt: now,
    updatedAt: now,
  });
  const store = readStore();
  store.watchers.push(watcher);
  writeStore(store);
  return watcher;
}

export function updateWatcher(id, patch) {
  const store = readStore();
  const idx = store.watchers.findIndex((w) => w.id === id);
  if (idx < 0) return null;
  const updated = normalizeWatcher({
    ...store.watchers[idx],
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  });
  store.watchers[idx] = updated;
  writeStore(store);
  return updated;
}

export function deleteWatcher(id) {
  const store = readStore();
  const before = store.watchers.length;
  store.watchers = store.watchers.filter((w) => w.id !== id);
  if (store.watchers.length === before) return false;
  writeStore(store);
  return true;
}

export function recordWatcherFire(watcherId, entry) {
  const store = readStore();
  store.history = store.history || [];
  store.history.push({
    id: randomUUID(),
    watcherId,
    at: new Date().toISOString(),
    ...entry,
  });
  if (store.history.length > 2000) store.history = store.history.slice(-2000);

  const idx = store.watchers.findIndex((w) => w.id === watcherId);
  if (idx >= 0) {
    store.watchers[idx].lastFiredAt = entry.at || new Date().toISOString();
    store.watchers[idx].lastRunId = entry.runId || null;
    store.watchers[idx].lastOutcome = entry.outcome || null;
    store.watchers[idx].updatedAt = new Date().toISOString();
  }
  writeStore(store);
}

export function listWatcherHistory({ watcherId = null, limit = 50 } = {}) {
  let entries = readStore().history || [];
  if (watcherId) entries = entries.filter((e) => e.watcherId === watcherId);
  return entries.slice(-limit).reverse();
}

export function resetWatchersForTests() {
  writeStore({ watchers: [], history: [] });
}
