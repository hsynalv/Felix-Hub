/**
 * Personal operating model preferences (V6.12).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_STORE_PATH = join(config.catalog?.cacheDir || "./cache", "operating-model.json");

function getStorePath() {
  return process.env.OPERATING_MODEL_PATH || DEFAULT_STORE_PATH;
}

function ensureStore() {
  const STORE_PATH = getStorePath();
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ preferences: [] }, null, 2), "utf8");
  }
}

function readStore() {
  const STORE_PATH = getStorePath();
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return { preferences: Array.isArray(raw.preferences) ? raw.preferences : [] };
  } catch {
    return { preferences: [] };
  }
}

function writeStore(data) {
  const STORE_PATH = getStorePath();
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

function normalizePref(p) {
  return {
    id: p.id,
    scope: p.scope || "global",
    projectId: p.projectId || null,
    key: p.key,
    value: p.value,
    pinned: !!p.pinned,
    source: p.source || "explicit",
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: p.updatedAt || new Date().toISOString(),
  };
}

export function listPreferences({ scope = null, projectId = null } = {}) {
  let items = readStore().preferences.map(normalizePref);
  if (scope) items = items.filter((p) => p.scope === scope);
  if (projectId) items = items.filter((p) => p.scope === "global" || p.projectId === projectId);
  return items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function rememberPreference({ scope = "global", projectId = null, key, value, pinned = false, source = "explicit" }) {
  if (!key) throw Object.assign(new Error("key required"), { code: "invalid" });
  const store = readStore();
  const existing = store.preferences.find(
    (p) => p.key === key && p.scope === scope && (p.projectId || null) === (projectId || null)
  );
  const now = new Date().toISOString();
  if (existing) {
    existing.value = value;
    existing.pinned = pinned || existing.pinned;
    existing.updatedAt = now;
    writeStore(store);
    return normalizePref(existing);
  }
  const pref = normalizePref({
    id: `pref-${randomUUID().slice(0, 8)}`,
    scope,
    projectId,
    key,
    value,
    pinned,
    source,
    createdAt: now,
    updatedAt: now,
  });
  store.preferences.push(pref);
  writeStore(store);
  return pref;
}

export function forgetPreference(id) {
  const store = readStore();
  const pref = store.preferences.find((p) => p.id === id);
  if (!pref) return false;
  if (pref.pinned) {
    throw Object.assign(new Error("Cannot delete pinned preference"), { code: "forbidden" });
  }
  store.preferences = store.preferences.filter((p) => p.id !== id);
  writeStore(store);
  return true;
}

export function pinPreference(id, pinned = true) {
  const store = readStore();
  const idx = store.preferences.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  store.preferences[idx].pinned = pinned;
  store.preferences[idx].updatedAt = new Date().toISOString();
  writeStore(store);
  return normalizePref(store.preferences[idx]);
}

export function getPreferenceById(id) {
  const pref = readStore().preferences.find((p) => p.id === id);
  return pref ? normalizePref(pref) : null;
}

export function updatePreferenceById(id, { key, value } = {}) {
  const store = readStore();
  const idx = store.preferences.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  if (key !== undefined) store.preferences[idx].key = key;
  if (value !== undefined) store.preferences[idx].value = value;
  store.preferences[idx].updatedAt = new Date().toISOString();
  writeStore(store);
  return normalizePref(store.preferences[idx]);
}

export function exportOperatingModel({ projectId = null } = {}) {
  return {
    exportedAt: new Date().toISOString(),
    preferences: listPreferences({ projectId }),
  };
}

export function getOperatingModelPromptContext({ projectId = null } = {}) {
  const prefs = listPreferences({ projectId });
  if (!prefs.length) return "";
  const lines = prefs.map((p) => `- ${p.key}: ${typeof p.value === "string" ? p.value : JSON.stringify(p.value)}${p.pinned ? " (pinned)" : ""}`);
  return `User operating preferences:\n${lines.join("\n")}`;
}

export function resetOperatingModelForTests() {
  writeStore({ preferences: [] });
}
