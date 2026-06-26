/**
 * Shared Redis Client
 * Used for pattern caching and draft session storage
 */

import { Redis } from "ioredis";

// ── Configuration ────────────────────────────────────────────────────────────

const REDIS_DEFAULT = "redis://localhost:6379";

function resolveRedisUrl() {
  return process.env.REDIS_URL || REDIS_DEFAULT;
}

const PATTERN_CACHE_TTL_DAYS = parseInt(process.env.PATTERN_CACHE_TTL_DAYS || "7", 10);
const DRAFT_SESSION_TTL_HOURS = parseInt(process.env.DRAFT_SESSION_TTL_HOURS || "1", 10);

// ── Redis Client ─────────────────────────────────────────────────────────────

let redis = null;
let lastRedisErrorLogAt = 0;

export function getRedis() {
  const url = resolveRedisUrl();
  if (!redis) {
    redis = new Redis(url, {
      connectTimeout: 2_000,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 20) return null;
        return Math.min(times * 200, 2_000);
      },
    });

    redis.on("error", (err) => {
      const now = Date.now();
      if (now - lastRedisErrorLogAt < 5_000) return;
      lastRedisErrorLogAt = now;
      const detail = err?.message || err?.code || String(err);
      console.error("Redis error:", detail);
    });

    redis.on("connect", () => {
      console.log("Redis connected");
    });
  }
  return redis;
}

export async function closeRedis() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

// ── Pattern Cache Operations ─────────────────────────────────────────────────

export async function getCachedPatterns(username) {
  const client = getRedis();
  const key = `patterns:${username}`;
  const data = await client.get(key);
  if (!data) return null;
  
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function setCachedPatterns(username, patterns) {
  const client = getRedis();
  const key = `patterns:${username}`;
  const ttlSeconds = PATTERN_CACHE_TTL_DAYS * 24 * 60 * 60;
  
  const data = {
    username,
    patterns,
    updatedAt: new Date().toISOString(),
  };
  
  await client.setex(key, ttlSeconds, JSON.stringify(data));
  return data;
}

export async function invalidatePatterns(username) {
  const client = getRedis();
  const key = `patterns:${username}`;
  await client.del(key);
}

// ── Draft Session Operations ─────────────────────────────────────────────────

export async function getDraft(draftId) {
  const client = getRedis();
  const key = `draft:${draftId}`;
  const data = await client.get(key);
  if (!data) return null;
  
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function setDraft(draftId, draft) {
  const client = getRedis();
  const key = `draft:${draftId}`;
  const ttlSeconds = DRAFT_SESSION_TTL_HOURS * 60 * 60;
  
  const data = {
    ...draft,
    id: draftId,
    createdAt: draft.createdAt || new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  };
  
  await client.setex(key, ttlSeconds, JSON.stringify(data));
  return data;
}

export async function deleteDraft(draftId) {
  const client = getRedis();
  const key = `draft:${draftId}`;
  await client.del(key);
}

// ── Health Check ──────────────────────────────────────────────────────────────

export async function checkRedisHealth({ timeoutMs = 1_500 } = {}) {
  try {
    const client = getRedis();
    await Promise.race([
      client.ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis connection timed out")), timeoutMs),
      ),
    ]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || err?.code || "Redis unavailable" };
  }
}
