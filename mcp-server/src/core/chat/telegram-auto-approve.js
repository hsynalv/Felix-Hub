/**
 * Auto-approve low-risk Notion writes from allowlisted Telegram chats.
 */

import { getEnvValue } from "../settings/effective-config.js";

const DEFAULT_AUTO_APPROVE = [
  "notion_setup_project",
  "notion_add_row",
  "notion_create_task",
  "fs_list",
  "fs_read",
  "fs_hash",
  "desktop_screenshot",
  "desktop_active_window",
  "desktop_ocr",
  "local_notify",
];

/**
 * @returns {Set<string>}
 */
export function getTelegramAutoApproveTools() {
  const raw = (getEnvValue("TELEGRAM_AUTO_APPROVE_TOOLS") || "").trim();
  const list = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_AUTO_APPROVE;
  return new Set(list);
}

function getAllowedChatIds() {
  const raw = (getEnvValue("TELEGRAM_ALLOWED_CHAT_IDS") || "").trim();
  if (!raw) return new Set();
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

/**
 * @param {object} context
 * @param {string} toolName
 */
export function shouldAutoApproveTelegramTool(context, toolName) {
  if (!context || context.channel !== "telegram") return false;
  const actor = String(context.actor || "");
  const chatId = actor.startsWith("telegram:") ? actor.slice("telegram:".length) : "";
  if (!chatId) return false;

  const readLocal = new Set([
    "fs_list",
    "fs_read",
    "fs_hash",
    "desktop_screenshot",
    "desktop_active_window",
    "desktop_ocr",
    "local_notify",
  ]);
  if (readLocal.has(toolName)) return true;

  if (!getAllowedChatIds().has(chatId)) return false;
  return getTelegramAutoApproveTools().has(toolName);
}
