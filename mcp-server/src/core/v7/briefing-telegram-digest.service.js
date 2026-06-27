/**
 * V7 — Format and push daily briefing digest to Telegram.
 */

import {
  sendTelegram,
  splitTelegramText,
  isTelegramConfigured,
  getTelegramConfig,
} from "../../plugins/notifications/channels/telegram.js";

/**
 * @param {object} briefing
 * @param {{ actionRequiredOnly?: boolean, maxItems?: number }} [opts]
 */
export function formatBriefingDigestText(briefing, { actionRequiredOnly = false, maxItems = 10 } = {}) {
  let items = briefing?.items || [];
  if (actionRequiredOnly) {
    items = items.filter((i) => i.actionRequired);
  }

  const lines = [`☀️ ${briefing?.summary || "Günlük özet"}`, ""];
  if (!items.length) {
    lines.push(actionRequiredOnly ? "Aksiyon gerektiren madde yok." : "Bugün için madde yok.");
    return lines.join("\n");
  }

  for (const item of items.slice(0, maxItems)) {
    const flag = item.actionRequired ? " ⚡" : "";
    const sources =
      item.dedupSources?.length > 1 ? ` (${item.dedupSources.filter(Boolean).join(", ")})` : "";
    lines.push(`• [${item.importance}] ${item.title}${flag}${sources}`);
    if (item.link || item.href) {
      lines.push(`  ${item.link || item.href}`);
    }
  }
  if (items.length > maxItems) {
    lines.push(`… +${items.length - maxItems} madde`);
  }
  return lines.join("\n");
}

export function isTelegramDigestAvailable() {
  return isTelegramConfigured();
}

/**
 * @param {object} briefing
 * @param {{ actionRequiredOnly?: boolean, chatId?: string }} [opts]
 */
export async function pushBriefingToTelegram(briefing, opts = {}) {
  if (!isTelegramConfigured()) {
    return { pushed: false, reason: "telegram_not_configured" };
  }

  const text = formatBriefingDigestText(briefing, opts);
  const { chatId } = getTelegramConfig();
  const targetChatId = opts.chatId || chatId;
  const chunks = splitTelegramText(text);
  let last;

  for (const chunk of chunks) {
    last = await sendTelegram({
      message: chunk,
      chatId: targetChatId,
      source: "briefing_scheduler",
    });
  }

  return { pushed: true, chunks: chunks.length, messageId: last?.messageId ?? null };
}
