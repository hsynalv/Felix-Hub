/**
 * Environment registry — dev/staging/production per project.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { getDefaultAutonomyLevel } from "../ops/autonomy.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.ENV_REGISTRY_STORE || join(config.catalog?.cacheDir || "./cache", "env-registry.json");

const STANDARD_ENVS = ["development", "staging", "production"];

const DEFAULT_AUTONOMY = {
  development: "L3",
  staging: "L2",
  production: "L1",
};

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ projects: {}, promotions: [] }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8"));
  } catch {
    return { projects: {}, promotions: [] };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

function defaultEnvConfig(name) {
  return {
    name,
    autonomyLevel: DEFAULT_AUTONOMY[name] || getDefaultAutonomyLevel(name),
    config: {},
    owner: null,
    rollbackRequired: name === "production",
  };
}

export function getEnvironmentRegistry(projectId) {
  const store = readStore();
  const project = store.projects[projectId];
  if (!project) {
    return {
      projectId,
      environments: Object.fromEntries(STANDARD_ENVS.map((e) => [e, defaultEnvConfig(e)])),
    };
  }
  return { projectId, ...project };
}

export function setEnvironmentRegistry(projectId, { environments = {}, owner = null } = {}) {
  const store = readStore();
  const existing = store.projects[projectId]?.environments || {};
  const merged = {};
  for (const env of STANDARD_ENVS) {
    merged[env] = { ...defaultEnvConfig(env), ...existing[env], ...environments[env], name: env };
  }
  store.projects[projectId] = {
    projectId,
    owner,
    environments: merged,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return getEnvironmentRegistry(projectId);
}

const SECRET_KEY_RE = /secret|password|token|key|credential|api_key/i;

export function maskSecrets(obj) {
  if (obj == null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(maskSecrets);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEY_RE.test(k)) {
      out[k] = typeof v === "string" && v.length > 4 ? `****${v.slice(-4)}` : "****";
    } else if (typeof v === "object") {
      out[k] = maskSecrets(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function diffConfigs(sourceConfig, targetConfig) {
  const source = maskSecrets(sourceConfig || {});
  const target = maskSecrets(targetConfig || {});
  const allKeys = new Set([...Object.keys(source), ...Object.keys(target)]);
  const diffs = [];

  for (const key of allKeys) {
    const a = JSON.stringify(source[key]);
    const b = JSON.stringify(target[key]);
    if (a !== b) {
      diffs.push({
        key,
        source: source[key],
        target: target[key],
        change: source[key] === undefined ? "added" : target[key] === undefined ? "removed" : "modified",
      });
    }
  }

  return { diffs, diffCount: diffs.length, masked: true };
}

export function resetEnvRegistryForTests() {
  writeStore({ projects: {}, promotions: [] });
}
