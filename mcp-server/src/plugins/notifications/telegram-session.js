/**
 * Telegram chat session store — Redis with in-memory fallback
 */

import { getEnvValue } from "../../core/settings/effective-config.js";

const memorySessions = new Map();
const SESSION_TTL_SEC = 24 * 60 * 60;
const KEY_PREFIX = "telegram:";

function sessionKey(chatId) {
  return `${KEY_PREFIX}${chatId}:session`;
}

async function getRedisClient() {
  try {
    const { getRedis } = await import("../../core/redis.js");
    if (!getEnvValue("REDIS_URL") && !process.env.REDIS_URL) return null;
    return getRedis();
  } catch {
    return null;
  }
}

export async function getTelegramSession(chatId) {
  const redis = await getRedisClient();
  const key = sessionKey(chatId);

  if (redis) {
    try {
      const raw = await redis.get(key);
      if (raw) return JSON.parse(raw);
    } catch {
      // fall through to memory
    }
  }

  return memorySessions.get(String(chatId)) || { history: [] };
}

export async function saveTelegramSession(chatId, session) {
  const redis = await getRedisClient();
  const key = sessionKey(chatId);
  const payload = JSON.stringify(session);

  if (redis) {
    try {
      await redis.setex(key, SESSION_TTL_SEC, payload);
      return;
    } catch {
      // fall through
    }
  }

  memorySessions.set(String(chatId), session);
}

export async function appendTelegramHistory(chatId, userMessage, assistantMessage) {
  const session = await getTelegramSession(chatId);
  const history = session.history || [];
  history.push({ role: "user", content: userMessage });
  if (assistantMessage) {
    history.push({ role: "assistant", content: assistantMessage });
  }
  const trimmed = history.slice(-20);
  await saveTelegramSession(chatId, { history: trimmed });
  return trimmed;
}

export function clearTelegramSessionMemory() {
  memorySessions.clear();
}
