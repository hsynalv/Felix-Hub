/**
 * Notification channel router — native OS + Telegram
 */

import { isTelegramConfigured, sendTelegram } from "./telegram.js";

export { isTelegramConfigured, sendTelegram, getTelegramConfig, escapeMarkdownV2 } from "./telegram.js";

export function getOS() {
  if (process.platform === "darwin") return "macos";
  if (process.platform === "win32") return "windows";
  if (process.platform === "linux") return "linux";
  return "unknown";
}

export function isNativeSupported() {
  return ["macos", "linux", "windows"].includes(getOS());
}

export function listAvailableChannels() {
  const channels = [];
  if (isNativeSupported()) {
    channels.push({
      id: "native",
      label: "Native OS",
      configured: true,
      platform: getOS(),
    });
  }
  channels.push({
    id: "telegram",
    label: "Telegram",
    configured: isTelegramConfigured(),
  });
  return channels;
}

/**
 * @param {"native"|"telegram"|"auto"} channel
 * @param {object} opts — title, message, sound, parseMode, nativeShow
 */
export async function sendViaChannel(channel, opts) {
  const resolved =
    channel === "auto"
      ? isTelegramConfigured()
        ? "telegram"
        : "native"
      : channel;

  if (resolved === "telegram") {
    const result = await sendTelegram({
      title: opts.title,
      message: opts.message,
      parseMode: opts.parseMode || null,
    });
    return { ...result, resolvedChannel: "telegram" };
  }

  if (resolved === "native") {
    if (!opts.nativeShow) {
      throw new Error("Native notification handler not provided");
    }
    const result = await opts.nativeShow({
      title: opts.title,
      message: opts.message,
      sound: opts.sound,
      subtitle: opts.subtitle,
    });
    return { ...result, resolvedChannel: "native" };
  }

  throw new Error(`Unknown notification channel: ${channel}`);
}
