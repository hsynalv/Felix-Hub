/**
 * Telegram notification channel (Bot API sendMessage)
 */

import { getEnvValue } from "../../../core/settings/effective-config.js";

const MDV2_SPECIAL = /[_*[\]()~`>#+\-=|{}.!\\]/g;

export function escapeMarkdownV2(text) {
  return String(text).replace(MDV2_SPECIAL, (ch) => `\\${ch}`);
}

export function formatMarkdownV2(title, message) {
  const parts = [];
  if (title) parts.push(`*${escapeMarkdownV2(title)}*`);
  if (message) parts.push(escapeMarkdownV2(message));
  return parts.join("\n\n");
}

export function getTelegramConfig() {
  return {
    token: (getEnvValue("TELEGRAM_BOT_TOKEN") || "").trim(),
    chatId: (getEnvValue("TELEGRAM_CHAT_ID") || "").trim(),
  };
}

export function isTelegramConfigured() {
  const { token, chatId } = getTelegramConfig();
  return !!(token && chatId);
}

const TELEGRAM_MSG_MAX = 4000;

/**
 * Split text into Telegram message-sized chunks.
 * @param {string} text
 * @param {number} [maxLen]
 */
export function splitTelegramText(text, maxLen = TELEGRAM_MSG_MAX) {
  const s = String(text || "");
  if (s.length <= maxLen) return [s];
  const chunks = [];
  let rest = s;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf("\n", maxLen);
    if (cut < maxLen * 0.5) cut = maxLen;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/**
 * @param {string} chatId
 * @param {"typing"|"upload_document"} [action]
 * @param {string} [token]
 */
export async function sendChatAction(chatId, action = "typing", token) {
  const cfg = getTelegramConfig();
  const botToken = (token || cfg.token).trim();
  const targetChatId = String(chatId || cfg.chatId).trim();
  if (!botToken || !targetChatId) return { success: false };

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: targetChatId, action }),
  });
  const data = await res.json().catch(() => ({}));
  return { success: res.ok && data.ok !== false };
}

/**
 * Send one or more messages (4000 char chunks).
 * @param {string} chatId
 * @param {string} text
 * @param {object} [opts]
 */
export async function replyToChatChunks(chatId, text, opts = {}) {
  const chunks = splitTelegramText(text);
  let last;
  for (const chunk of chunks) {
    last = await sendTelegram({ message: chunk, chatId: String(chatId), ...opts });
  }
  return last;
}

/**
 * @param {object} opts
 * @param {string} [opts.title]
 * @param {string} opts.message
 * @param {string} [opts.token]
 * @param {string} [opts.chatId]
 * @param {"MarkdownV2"|null} [opts.parseMode]
 */
export async function sendTelegram({
  title,
  message,
  token,
  chatId,
  parseMode = null,
}) {
  const cfg = getTelegramConfig();
  const botToken = (token || cfg.token).trim();
  const targetChatId = (chatId || cfg.chatId).trim();

  if (!botToken || !targetChatId) {
    throw new Error(
      "Telegram not configured: set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID"
    );
  }

  const plainText = [title, message].filter(Boolean).join("\n\n");
  const body = { chat_id: targetChatId, text: plainText };

  if (parseMode === "MarkdownV2") {
    body.parse_mode = "MarkdownV2";
    body.text = formatMarkdownV2(title || "", message || "");
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok || data.ok === false) {
    const desc = data.description || "";
    if (res.status === 401 || desc.toLowerCase().includes("unauthorized")) {
      throw new Error("Invalid Telegram bot token");
    }
    if (res.status === 400) {
      throw new Error(desc || "Invalid Telegram chat ID or message format");
    }
    throw new Error(desc || `Telegram API error (${res.status})`);
  }

  return {
    success: true,
    channel: "telegram",
    messageId: data.result?.message_id ?? null,
  };
}

/**
 * @param {string} chatId
 * @param {string} text
 * @param {{ inline_keyboard?: unknown[] }} [replyMarkup]
 */
export async function sendTelegramWithMarkup(chatId, text, replyMarkup) {
  const cfg = getTelegramConfig();
  const botToken = cfg.token.trim();
  if (!botToken || !chatId) throw new Error("Telegram not configured");

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: String(chatId),
      text: String(text).slice(0, 4000),
      reply_markup: replyMarkup,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.description || `Telegram API error (${res.status})`);
  }
  return { success: true, messageId: data.result?.message_id ?? null };
}

export async function answerCallbackQuery(callbackQueryId, text) {
  const cfg = getTelegramConfig();
  const botToken = cfg.token.trim();
  if (!botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text: text?.slice(0, 200) }),
  }).catch(() => {});
}
