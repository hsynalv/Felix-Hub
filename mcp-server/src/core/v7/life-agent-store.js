/**
 * V7 — Life agent profile persistence.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.LIFE_AGENT_STORE || join(config.catalog?.cacheDir || "./cache", "life-agents.json");

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ agents: [], history: [] }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return {
      agents: Array.isArray(raw.agents) ? raw.agents : [],
      history: Array.isArray(raw.history) ? raw.history : [],
    };
  } catch {
    return { agents: [], history: [] };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

function normalize(agent) {
  return {
    id: agent.id,
    name: agent.name,
    goal: agent.goal || "",
    type: agent.type || "custom",
    presetId: agent.presetId || null,
    sources: Array.isArray(agent.sources) ? agent.sources : [],
    allowedTools: Array.isArray(agent.allowedTools) ? agent.allowedTools : [],
    schedule: agent.schedule || null,
    approvalPolicy: agent.approvalPolicy || "L3",
    outputChannels: Array.isArray(agent.outputChannels) ? agent.outputChannels : ["inbox"],
    memoryScope: agent.memoryScope || "personal",
    costLimitUsd: agent.costLimitUsd ?? 1,
    enabled: agent.enabled !== false,
    watcherId: agent.watcherId || null,
    lastRunAt: agent.lastRunAt || null,
    lastRunId: agent.lastRunId || null,
    createdAt: agent.createdAt || new Date().toISOString(),
    updatedAt: agent.updatedAt || new Date().toISOString(),
  };
}

export function listLifeAgents({ enabled = null } = {}) {
  let items = readStore().agents.map(normalize);
  if (enabled === true) items = items.filter((a) => a.enabled);
  if (enabled === false) items = items.filter((a) => !a.enabled);
  return items;
}

export function getLifeAgentById(id) {
  const a = readStore().agents.find((x) => x.id === id);
  return a ? normalize(a) : null;
}

export function createLifeAgent(input) {
  if (!input.name) {
    throw Object.assign(new Error("name required"), { code: "invalid" });
  }
  const now = new Date().toISOString();
  const agent = normalize({
    ...input,
    id: input.id || `life-${randomUUID().slice(0, 8)}`,
    createdAt: now,
    updatedAt: now,
  });
  const store = readStore();
  store.agents.push(agent);
  writeStore(store);
  return agent;
}

export function updateLifeAgent(id, patch) {
  const store = readStore();
  const idx = store.agents.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const updated = normalize({
    ...store.agents[idx],
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  });
  store.agents[idx] = updated;
  writeStore(store);
  return updated;
}

export function deleteLifeAgent(id) {
  const store = readStore();
  const before = store.agents.length;
  store.agents = store.agents.filter((a) => a.id !== id);
  if (store.agents.length === before) return false;
  writeStore(store);
  return true;
}

export function recordLifeAgentRun(agentId, entry) {
  const store = readStore();
  store.history = store.history || [];
  store.history.push({
    id: randomUUID(),
    agentId,
    at: new Date().toISOString(),
    ...entry,
  });
  if (store.history.length > 500) store.history = store.history.slice(-500);
  const idx = store.agents.findIndex((a) => a.id === agentId);
  if (idx >= 0) {
    store.agents[idx].lastRunAt = entry.at || new Date().toISOString();
    store.agents[idx].lastRunId = entry.runId || null;
    store.agents[idx].updatedAt = new Date().toISOString();
  }
  writeStore(store);
}

export function listLifeAgentHistory({ agentId = null, limit = 30 } = {}) {
  let entries = readStore().history || [];
  if (agentId) entries = entries.filter((e) => e.agentId === agentId);
  return entries.slice(-limit).reverse();
}

/** @internal */
export function resetLifeAgentsForTests() {
  writeStore({ agents: [], history: [] });
}
