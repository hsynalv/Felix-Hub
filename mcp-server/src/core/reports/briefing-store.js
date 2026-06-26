/**
 * Briefing inbox persistence.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.BRIEFING_STORE || join(config.catalog?.cacheDir || "./cache", "briefings.json");

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
    return Array.isArray(raw.briefings) ? raw.briefings : [];
  } catch {
    return [];
  }
}

function writeStore(briefings) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ briefings, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

export function listBriefings({ projectId = null, archived = false, limit = 50 } = {}) {
  let items = readStore();
  if (projectId) items = items.filter((b) => b.projectId === projectId);
  items = items.filter((b) => !!b.archived === archived);
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
}

export function getBriefingById(id) {
  return readStore().find((b) => b.id === id) || null;
}

export function saveBriefing(entry) {
  const briefings = readStore();
  const briefing = {
    id: entry.id || randomUUID(),
    type: entry.type,
    title: entry.title,
    projectId: entry.projectId || null,
    markdown: entry.markdown,
    sections: entry.sections || {},
    channels: entry.channels || [],
    deliveryLog: entry.deliveryLog || [],
    read: false,
    archived: false,
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  briefings.push(briefing);
  if (briefings.length > 500) briefings.splice(0, briefings.length - 500);
  writeStore(briefings);
  return briefing;
}

export function markBriefingRead(id, read = true) {
  const briefings = readStore();
  const idx = briefings.findIndex((b) => b.id === id);
  if (idx < 0) return null;
  briefings[idx].read = read;
  briefings[idx].updatedAt = new Date().toISOString();
  writeStore(briefings);
  return briefings[idx];
}

export function archiveBriefing(id, archived = true) {
  const briefings = readStore();
  const idx = briefings.findIndex((b) => b.id === id);
  if (idx < 0) return null;
  briefings[idx].archived = archived;
  briefings[idx].updatedAt = new Date().toISOString();
  writeStore(briefings);
  return briefings[idx];
}

export function appendDeliveryLog(id, logEntry) {
  const briefings = readStore();
  const idx = briefings.findIndex((b) => b.id === id);
  if (idx < 0) return null;
  briefings[idx].deliveryLog = briefings[idx].deliveryLog || [];
  briefings[idx].deliveryLog.push({ at: new Date().toISOString(), ...logEntry });
  briefings[idx].updatedAt = new Date().toISOString();
  writeStore(briefings);
  return briefings[idx];
}

export function resetBriefingsForTests() {
  writeStore([]);
}
