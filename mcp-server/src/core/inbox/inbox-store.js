/**
 * Inbox user state — read / snooze per unified item id.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.INBOX_STORE || join(config.catalog?.cacheDir || "./cache", "inbox-state.json");

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ items: {} }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return { items: raw.items && typeof raw.items === "object" ? raw.items : {} };
  } catch {
    return { items: {} };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

export function getInboxItemState(itemId) {
  return readStore().items[itemId] || null;
}

export function markInboxItemRead(itemId) {
  const store = readStore();
  store.items[itemId] = {
    ...store.items[itemId],
    readAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return store.items[itemId];
}

export function snoozeInboxItem(itemId, untilIso) {
  const store = readStore();
  store.items[itemId] = {
    ...store.items[itemId],
    snoozedUntil: untilIso,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return store.items[itemId];
}

export function clearInboxItemState(itemId) {
  const store = readStore();
  delete store.items[itemId];
  writeStore(store);
}

export function resetInboxForTests() {
  writeStore({ items: {} });
}
