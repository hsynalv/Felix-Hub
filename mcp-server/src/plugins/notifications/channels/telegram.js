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
