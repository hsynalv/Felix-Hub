/**
 * Installed agent products per project (V6.8).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.APP_STORE_PATH || join(config.catalog?.cacheDir || "./cache", "agent-app-store.json");

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ installations: [] }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return { installations: Array.isArray(raw.installations) ? raw.installations : [] };
  } catch {
    return { installations: [] };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

export function listInstallations({ projectId = null } = {}) {
  let items = readStore().installations;
  if (projectId) items = items.filter((i) => i.projectId === projectId);
  return items.sort((a, b) => new Date(b.installedAt) - new Date(a.installedAt));
}

export function getInstallation(productId, projectId) {
  return readStore().installations.find((i) => i.productId === productId && i.projectId === projectId) || null;
}

export function recordInstallation(entry) {
  const store = readStore();
  store.installations = store.installations.filter(
    (i) => !(i.productId === entry.productId && i.projectId === entry.projectId)
  );
  const record = {
    id: entry.id || `install-${randomUUID().slice(0, 8)}`,
    productId: entry.productId,
    productVersion: entry.productVersion,
    projectId: entry.projectId,
    watcherId: entry.watcherId || null,
    skillId: entry.skillId || null,
    templateId: entry.templateId || null,
    installedAt: entry.installedAt || new Date().toISOString(),
    installedBy: entry.installedBy || "api",
  };
  store.installations.push(record);
  writeStore(store);
  return record;
}

export function removeInstallation(productId, projectId) {
  const store = readStore();
  const before = store.installations.length;
  store.installations = store.installations.filter(
    (i) => !(i.productId === productId && i.projectId === projectId)
  );
  if (store.installations.length === before) return null;
  writeStore(store);
  return true;
}

export function resetAppStoreForTests() {
  writeStore({ installations: [] });
}
