/**
 * External observability signals (Sentry, Datadog, generic webhook).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.OBSERVABILITY_SIGNALS_STORE ||
  join(config.catalog?.cacheDir || "./cache", "observability-signals.json");

const MAX_SIGNALS = 200;

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ signals: [] }, null, 2), "utf8");
  }
}

function readSignals() {
  ensureStore();
  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return Array.isArray(parsed.signals) ? parsed.signals : [];
  } catch {
    return [];
  }
}

function writeSignals(signals) {
  ensureStore();
  writeFileSync(
    STORE_PATH,
    JSON.stringify({ signals: signals.slice(0, MAX_SIGNALS), updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

export function ingestObservabilitySignal({
  source,
  projectId = null,
  message,
  severity = "error",
  payload = {},
  spike = true,
} = {}) {
  if (!source || !message) {
    throw Object.assign(new Error("source and message required"), { code: "invalid" });
  }

  const signal = {
    id: `obs-${randomUUID().slice(0, 8)}`,
    source,
    projectId,
    message: String(message).slice(0, 2000),
    severity,
    spike: spike !== false,
    payload,
    detectedAt: new Date().toISOString(),
  };

  const signals = readSignals();
  signals.unshift(signal);
  writeSignals(signals);
  return signal;
}

export function listObservabilitySignals({ projectId = null, source = null, limit = 20, windowMinutes = 120 } = {}) {
  const since = Date.now() - windowMinutes * 60 * 1000;
  let items = readSignals().filter((s) => new Date(s.detectedAt).getTime() >= since);
  if (projectId) items = items.filter((s) => !s.projectId || s.projectId === projectId);
  if (source) items = items.filter((s) => s.source === source);
  return items.slice(0, limit);
}

export function getLatestObservabilitySignal({ projectId = null } = {}) {
  const items = listObservabilitySignals({ projectId, limit: 1, windowMinutes: 24 * 60 });
  return items[0] || null;
}

export function resetObservabilitySignalsForTests() {
  writeSignals([]);
}
