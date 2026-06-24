/**
 * Settings validation preview (no persist)
 */

import { getEnvValue } from "./effective-config.js";
import { isPersistenceHealthy, persistenceQuery } from "../persistence/index.js";

async function validateRedis(url) {
  const prev = process.env.REDIS_URL;
  try {
    if (url) process.env.REDIS_URL = url;
    const { checkRedisHealth } = await import("../redis.js");
    const h = await checkRedisHealth();
    return { ok: h.ok ?? h.healthy ?? false, detail: h };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    if (prev !== undefined) process.env.REDIS_URL = prev;
    else delete process.env.REDIS_URL;
  }
}

async function validateMssql(urlOrConn) {
  if (!urlOrConn) return { ok: false, error: "missing connection string" };
  if (!isPersistenceHealthy()) {
    try {
      await persistenceQuery("SELECT 1 AS ok");
      return { ok: true, detail: "existing pool" };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  try {
    await persistenceQuery("SELECT 1 AS ok");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function validateOpenAi(key) {
  if (!key) return { ok: false, error: "missing API key" };
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

const VALIDATORS = {
  REDIS_URL: (v) => validateRedis(v),
  HUB_MSSQL_URL: (v) => validateMssql(v),
  MSSQL_CONNECTION_STRING: (v) => validateMssql(v),
  OPENAI_API_KEY: (v) => validateOpenAi(v),
};

export async function validateKeys(keys) {
  const results = {};
  for (const key of keys) {
    const value = getEnvValue(key) || process.env[key] || "";
    const fn = VALIDATORS[key];
    if (!fn) {
      results[key] = { ok: null, skipped: true, message: "no validator" };
      continue;
    }
    results[key] = await fn(value);
  }
  return results;
}

export async function validateSingleKey(key, overrideValue) {
  const fn = VALIDATORS[key];
  if (!fn) return { ok: null, skipped: true };
  const value = overrideValue ?? getEnvValue(key) ?? "";
  return { key, ...(await fn(value)) };
}
