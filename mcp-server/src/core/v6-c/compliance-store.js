/**
 * Enterprise compliance policy store (V6.9).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.COMPLIANCE_STORE || join(config.catalog?.cacheDir || "./cache", "compliance-policy.json");

const DEFAULT_POLICY = {
  auditRetentionDays: 90,
  runRetentionDays: 90,
  piiRedaction: true,
  legalHold: false,
  ssoEnabled: false,
  scimEnabled: false,
};

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ policy: DEFAULT_POLICY }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return { policy: { ...DEFAULT_POLICY, ...(raw.policy || {}) } };
  } catch {
    return { policy: { ...DEFAULT_POLICY } };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(
    STORE_PATH,
    JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

export function getCompliancePolicy() {
  return readStore().policy;
}

export function setCompliancePolicy(patch) {
  const store = readStore();
  store.policy = { ...store.policy, ...patch, updatedAt: new Date().toISOString() };
  writeStore(store);
  return store.policy;
}

export function resetComplianceForTests() {
  writeStore({ policy: DEFAULT_POLICY });
}
