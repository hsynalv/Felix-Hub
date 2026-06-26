/**
 * V7 — Shopping research session store.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.SHOPPING_STORE || join(config.catalog?.cacheDir || "./cache", "shopping-sessions.json");

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ sessions: [] }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return { sessions: Array.isArray(raw.sessions) ? raw.sessions : [] };
  } catch {
    return { sessions: [] };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

export function createShoppingSession({ query, results = [] }) {
  const session = {
    id: `shop-${randomUUID().slice(0, 8)}`,
    query,
    results,
    selectedId: null,
    cartRequest: null,
    status: "researching",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const store = readStore();
  store.sessions.unshift(session);
  if (store.sessions.length > 100) store.sessions = store.sessions.slice(0, 100);
  writeStore(store);
  return session;
}

export function getShoppingSession(id) {
  return readStore().sessions.find((s) => s.id === id) || null;
}

export function listShoppingSessions({ limit = 20 } = {}) {
  return readStore().sessions.slice(0, limit);
}

export function updateShoppingSession(id, patch) {
  const store = readStore();
  const idx = store.sessions.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  store.sessions[idx] = {
    ...store.sessions[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return store.sessions[idx];
}

/** @internal */
export function resetShoppingStoreForTests() {
  writeStore({ sessions: [] });
}
