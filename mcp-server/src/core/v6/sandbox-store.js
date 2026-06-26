/**
 * Sandbox simulation session persistence (V6.4).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.SANDBOX_STORE || join(config.catalog?.cacheDir || "./cache", "sandbox-sessions.json");

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

function normalizeSession(s) {
  return {
    id: s.id,
    name: s.name || "Sandbox session",
    projectId: s.projectId || null,
    status: s.status || "active",
    mocks: s.mocks || {},
    calls: Array.isArray(s.calls) ? s.calls : [],
    createdAt: s.createdAt || new Date().toISOString(),
    updatedAt: s.updatedAt || new Date().toISOString(),
    closedAt: s.closedAt || null,
  };
}

export function listSandboxSessions({ projectId = null, status = null } = {}) {
  let items = readStore().sessions.map(normalizeSession);
  if (projectId) items = items.filter((s) => !s.projectId || s.projectId === projectId);
  if (status) items = items.filter((s) => s.status === status);
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getSandboxSession(id) {
  const s = readStore().sessions.find((x) => x.id === id);
  return s ? normalizeSession(s) : null;
}

export function createSandboxSession(input = {}) {
  const now = new Date().toISOString();
  const session = normalizeSession({
    ...input,
    id: input.id || `sandbox-${randomUUID().slice(0, 8)}`,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  const store = readStore();
  store.sessions.push(session);
  writeStore(store);
  return session;
}

export function updateSandboxSession(id, patch) {
  const store = readStore();
  const idx = store.sessions.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  const updated = normalizeSession({
    ...store.sessions[idx],
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  });
  store.sessions[idx] = updated;
  writeStore(store);
  return updated;
}

export function closeSandboxSession(id) {
  return updateSandboxSession(id, { status: "closed", closedAt: new Date().toISOString() });
}

export function recordSandboxCall(sessionId, toolName, args, result) {
  const store = readStore();
  const idx = store.sessions.findIndex((s) => s.id === sessionId);
  if (idx < 0) return null;
  const call = {
    at: new Date().toISOString(),
    tool: toolName,
    args,
    result,
  };
  store.sessions[idx].calls = store.sessions[idx].calls || [];
  store.sessions[idx].calls.push(call);
  if (store.sessions[idx].calls.length > 500) {
    store.sessions[idx].calls = store.sessions[idx].calls.slice(-500);
  }
  store.sessions[idx].updatedAt = new Date().toISOString();
  writeStore(store);
  return normalizeSession(store.sessions[idx]);
}

export function resetSandboxForTests() {
  writeStore({ sessions: [] });
}
