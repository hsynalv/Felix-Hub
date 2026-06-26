/**
 * Knowledge conflict resolutions (V6.11).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.CONFLICT_STORE || join(config.catalog?.cacheDir || "./cache", "knowledge-conflicts.json");

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ conflicts: [], resolutions: [] }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return {
      conflicts: Array.isArray(raw.conflicts) ? raw.conflicts : [],
      resolutions: Array.isArray(raw.resolutions) ? raw.resolutions : [],
    };
  } catch {
    return { conflicts: [], resolutions: [] };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

export function listStoredConflicts({ projectId = null, status = null } = {}) {
  let items = readStore().conflicts;
  if (projectId) items = items.filter((c) => c.projectId === projectId);
  if (status) items = items.filter((c) => c.status === status);
  return items.sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt));
}

export function saveConflict(conflict) {
  const store = readStore();
  const record = {
    id: conflict.id || `conflict-${randomUUID().slice(0, 8)}`,
    ...conflict,
    status: conflict.status || "open",
    detectedAt: conflict.detectedAt || new Date().toISOString(),
  };
  const idx = store.conflicts.findIndex((c) => c.id === record.id);
  if (idx >= 0) store.conflicts[idx] = record;
  else store.conflicts.push(record);
  writeStore(store);
  return record;
}

export function resolveConflict(conflictId, { acceptedSource, pin = false, resolvedBy = "api" } = {}) {
  const store = readStore();
  const idx = store.conflicts.findIndex((c) => c.id === conflictId);
  if (idx < 0) return null;

  store.conflicts[idx].status = "resolved";
  store.conflicts[idx].resolvedAt = new Date().toISOString();
  store.conflicts[idx].acceptedSource = acceptedSource;
  store.conflicts[idx].pinned = pin;

  store.resolutions.push({
    id: randomUUID(),
    conflictId,
    acceptedSource,
    pin,
    resolvedBy,
    at: new Date().toISOString(),
  });
  writeStore(store);
  return store.conflicts[idx];
}

export function resetConflictsForTests() {
  writeStore({ conflicts: [], resolutions: [] });
}
