/**
 * V7 daily briefing persistence (JSON).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { config } from "../config.js";

const STORE_PATH =
  process.env.PERSONAL_BRIEFING_PATH || join(config.catalog?.cacheDir || "./cache", "personal-briefings.json");

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ briefings: [] }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return { briefings: Array.isArray(raw.briefings) ? raw.briefings : [] };
  } catch {
    return { briefings: [] };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

export function resetBriefingStoreForTests() {
  writeStore({ briefings: [] });
}

export function saveBriefing(record) {
  const store = readStore();
  const entry = {
    id: record.id || `brief-${randomUUID().slice(0, 8)}`,
    date: record.date,
    scope: record.scope || "personal",
    summary: record.summary,
    items: record.items || [],
    stats: record.stats || {},
    sources: record.sources || [],
    generatedAt: record.generatedAt || new Date().toISOString(),
  };
  store.briefings = [entry, ...store.briefings.filter((b) => b.date !== entry.date || b.scope !== entry.scope)].slice(0, 30);
  writeStore(store);
  return entry;
}

export function getLatestBriefing({ scope = "personal", date = null } = {}) {
  const store = readStore();
  const targetDate = date || new Date().toISOString().slice(0, 10);
  return (
    store.briefings.find((b) => b.scope === scope && b.date === targetDate) ||
    store.briefings.find((b) => b.scope === scope) ||
    null
  );
}

export function listBriefings({ limit = 10 } = {}) {
  return readStore().briefings.slice(0, limit);
}
