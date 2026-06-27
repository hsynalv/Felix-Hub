/**
 * Telegram notification channel (Bot API sendMessage)
 */

import { getEnvValue } from "../../../core/settings/effective-config.js";
import { logTelegramOutbound } from "../../../core/v7/telegram-outbound-store.js";

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
 * @param {string} [opts.source] — log kaynağı (telegram_commands, notifications, …)
 */
export async function sendTelegram({
  title,
  message,
  token,
  chatId,
  parseMode = null,
  source = "notifications",
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
      const err = new Error("Invalid Telegram bot token");
      logTelegramOutbound({
        chatId: targetChatId,
        text: plainText,
        source,
        success: false,
        error: err.message,
      });
      throw err;
    }
    if (res.status === 400) {
      const err = new Error(desc || "Invalid Telegram chat ID or message format");
      logTelegramOutbound({
        chatId: targetChatId,
        text: plainText,
        source,
        success: false,
        error: err.message,
      });
      throw err;
    }
    const err = new Error(desc || `Telegram API error (${res.status})`);
    logTelegramOutbound({
      chatId: targetChatId,
      text: plainText,
      source,
      success: false,
      error: err.message,
    });
    throw err;
  }

  logTelegramOutbound({
    chatId: targetChatId,
    text: plainText,
    source,
    messageId: data.result?.message_id ?? null,
    success: true,
  });

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
 * @param {string} [source]
 */
export async function sendTelegramWithMarkup(chatId, text, replyMarkup, source = "telegram_commands") {
  const cfg = getTelegramConfig();
  const botToken = cfg.token.trim();
  if (!botToken || !chatId) throw new Error("Telegram not configured");

  const bodyText = String(text).slice(0, 4000);
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: String(chatId),
      text: bodyText,
      reply_markup: replyMarkup,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const err = new Error(data.description || `Telegram API error (${res.status})`);
    logTelegramOutbound({
      chatId,
      text: bodyText,
      source,
      success: false,
      error: err.message,
      hasMarkup: !!replyMarkup,
    });
    throw err;
  }
  logTelegramOutbound({
    chatId,
    text: bodyText,
    source,
    messageId: data.result?.message_id ?? null,
    success: true,
    hasMarkup: !!replyMarkup,
  });
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

/**
 * @param {string} chatId
 * @param {string} base64
 * @param {{ filename?: string; caption?: string; source?: string }} [opts]
 */
export async function sendTelegramPhotoBase64(chatId, base64, opts = {}) {
  const cfg = getTelegramConfig();
  const botToken = cfg.token.trim();
  if (!botToken || !chatId) throw new Error("Telegram not configured");

  const buf = Buffer.from(String(base64), "base64");
  const filename = opts.filename || "photo.png";
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("photo", new Blob([buf]), filename);
  if (opts.caption) form.append("caption", String(opts.caption).slice(0, 1024));

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.description || `Telegram sendPhoto failed (${res.status})`);
  }
  logTelegramOutbound({
    chatId,
    text: opts.caption || "[photo]",
    source: opts.source || "telegram_photo",
    messageId: data.result?.message_id ?? null,
    success: true,
  });
  return { success: true, messageId: data.result?.message_id ?? null };
}

/**
 * @param {string} chatId
 * @param {string} base64
 * @param {{ filename?: string; caption?: string; source?: string }} [opts]
 */
export async function sendTelegramDocumentBase64(chatId, base64, opts = {}) {
  const cfg = getTelegramConfig();
  const botToken = cfg.token.trim();
  if (!botToken || !chatId) throw new Error("Telegram not configured");

  const buf = Buffer.from(String(base64), "base64");
  const filename = opts.filename || "file.bin";
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("document", new Blob([buf]), filename);
  if (opts.caption) form.append("caption", String(opts.caption).slice(0, 1024));

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.description || `Telegram sendDocument failed (${res.status})`);
  }
  logTelegramOutbound({
    chatId,
    text: opts.caption || `[document:${filename}]`,
    source: opts.source || "telegram_document",
    messageId: data.result?.message_id ?? null,
    success: true,
  });
  return { success: true, messageId: data.result?.message_id ?? null };
}
