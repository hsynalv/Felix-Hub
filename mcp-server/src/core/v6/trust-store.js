/**
 * Agent trust score cache (V6.5).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.TRUST_STORE || join(config.catalog?.cacheDir || "./cache", "agent-trust-scores.json");

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ scores: [] }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return { scores: Array.isArray(raw.scores) ? raw.scores : [] };
  } catch {
    return { scores: [] };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

export function listCachedTrustScores() {
  return readStore().scores;
}

export function upsertTrustScore(entry) {
  const store = readStore();
  const key = `${entry.entityType}:${entry.entityId}`;
  const idx = store.scores.findIndex((s) => `${s.entityType}:${s.entityId}` === key);
  const record = {
    ...entry,
    key,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) store.scores[idx] = record;
  else store.scores.push(record);
  writeStore(store);
  return record;
}

export function getCachedTrustScore(entityType, entityId) {
  const key = `${entityType}:${entityId}`;
  return readStore().scores.find((s) => s.key === key || (s.entityType === entityType && s.entityId === entityId)) || null;
}

export function resetTrustForTests() {
  writeStore({ scores: [] });
}
