/**
 * V7 — Outbound Telegram message log (hub → Telegram).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { randomUUID } from "crypto";
import { config } from "../config.js";

const DEFAULT_STORE_PATH = join(config.catalog?.cacheDir || "./cache", "telegram-outbound.json");
const MAX_ENTRIES = 500;

function getStorePath() {
  return process.env.TELEGRAM_OUTBOUND_LOG_PATH || DEFAULT_STORE_PATH;
}

function ensureStore() {
  const STORE_PATH = getStorePath();
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ messages: [] }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(getStorePath(), "utf8"));
    return { messages: Array.isArray(raw.messages) ? raw.messages : [] };
  } catch {
    return { messages: [] };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(getStorePath(), JSON.stringify(data, null, 2), "utf8");
}

export function resetTelegramOutboundStoreForTests() {
  writeStore({ messages: [] });
}

/**
 * @param {{ chatId: string, text: string, kind?: string, source?: string, messageId?: number|null, success?: boolean, error?: string|null, hasMarkup?: boolean }} entry
 */
export function logTelegramOutbound({
  chatId,
  text,
  kind = "message",
  source = "hub",
  messageId = null,
  success = true,
  error = null,
  hasMarkup = false,
}) {
  const store = readStore();
  const record = {
    id: `tg-out-${randomUUID().slice(0, 10)}`,
    chatId: String(chatId),
    text: String(text || "").slice(0, 4000),
    preview: String(text || "").slice(0, 200),
    kind,
    source,
    messageId,
    success,
    error,
    hasMarkup,
    sentAt: new Date().toISOString(),
  };
  store.messages = [record, ...store.messages].slice(0, MAX_ENTRIES);
  writeStore(store);
  return record;
}

export function listTelegramOutbound({ limit = 50, chatId = null } = {}) {
  let messages = readStore().messages;
  if (chatId) {
    messages = messages.filter((m) => m.chatId === String(chatId));
  }
  return messages.slice(0, Math.min(limit, MAX_ENTRIES));
}
