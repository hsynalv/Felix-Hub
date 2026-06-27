/**
 * V9/V10 — Telegram agent session: approvals + sidecar deliverables (photo/file).
 */

import { registerAfterExecutionHook } from "../tool-hooks.js";
import {
  sendTelegramWithMarkup,
  sendTelegramPhotoBase64,
  sendTelegramDocumentBase64,
  sendChatAction,
} from "../../plugins/notifications/channels/telegram.js";
import { resolveChatApproval } from "../chat-orchestrator.js";

const TELEGRAM_MAX_DOC_BYTES = 45 * 1024 * 1024;

const SCREENSHOT_TOOLS = new Set([
  "desktop_screenshot",
  "desktop_region_screenshot",
  "desktop_window_screenshot",
  "browser_screenshot",
]);

let deliveryHookRegistered = false;

/**
 * @param {string} chatId
 * @param {(msg: string) => Promise<unknown>} reply
 */
export function createTelegramOnApproval(chatId, reply) {
  return async (payload) => {
    const { approvalId, tool, arguments: args, message, preview } = payload;
    const explanation = args?.explanation || message || "";
    const previewSummary = preview?.summary || payload.metadata?.preview?.summary;
    const text = [
      "Onay gerekli",
      `Araç: ${tool}`,
      previewSummary ? `Önizleme: ${previewSummary}` : "",
      explanation ? `Açıklama: ${String(explanation).slice(0, 500)}` : "",
      "",
      "Onayla veya reddet:",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await sendTelegramWithMarkup(
        chatId,
        text,
        {
          inline_keyboard: [
            [
              { text: "Onayla", callback_data: `tapprove:${approvalId}` },
              { text: "Reddet", callback_data: `tdeny:${approvalId}` },
            ],
          ],
        },
        "telegram_agent_approval",
      );
    } catch {
      await reply(`${text}\n\nOnay ID: ${approvalId} (UI'dan onaylayın)`);
    }
  };
}

/**
 * Resolve inline keyboard tool approval from Telegram callback.
 * @param {string} approvalId
 * @param {boolean} approved
 */
export async function resolveTelegramToolApproval(approvalId, approved) {
  return resolveChatApproval(approvalId, approved);
}

function extractTelegramChatId(context) {
  const actor = String(context?.actor || "");
  if (!actor.startsWith("telegram:")) return null;
  return actor.slice("telegram:".length);
}

async function deliverScreenshotToTelegram(chatId, result, label = "Felix Desktop screenshot") {
  if (result.data?.deliveryBlocked || result.data?.sensitiveContext) {
    await sendTelegramWithMarkup(
      chatId,
      `Ekran görüntüsü Telegram'a gönderilmedi (hassas içerik): ${(result.data.sensitiveReasons || []).join(", ") || "login/payment context"}`,
      undefined,
      "telegram_sidecar_sensitive_block",
    ).catch(() => {});
    return;
  }

  const b64 = result.data?.imageBase64 || result.data?.base64;
  if (!b64) return;
  await sendChatAction(chatId, "upload_photo").catch(() => {});
  await sendTelegramPhotoBase64(chatId, b64, {
    caption: label,
    filename: `screenshot.${result.data?.format || "png"}`,
    source: "telegram_sidecar_delivery",
  }).catch(() => {});
}

export function registerTelegramSidecarDeliveryHook() {
  if (deliveryHookRegistered) return;
  deliveryHookRegistered = true;

  registerAfterExecutionHook(async (toolName, _args, context, result) => {
    if (context?.channel !== "telegram" || !result?.ok) return;
    const chatId = extractTelegramChatId(context);
    if (!chatId) return;

    if (SCREENSHOT_TOOLS.has(toolName)) {
      const label =
        toolName === "browser_screenshot"
          ? `Felix Browser — ${result.data?.url || "page"}`
          : toolName === "desktop_region_screenshot"
          ? "Felix Desktop — bölge ekran görüntüsü"
          : toolName === "desktop_window_screenshot"
            ? `Felix Desktop — ${result.data?.window?.app || "pencere"}`
            : "Felix Desktop screenshot";
      await deliverScreenshotToTelegram(chatId, result, label);
      return;
    }

    if (toolName === "fs_read") {
      const content = result.data?.content;
      const path = result.data?.path || result.data?.resolvedPath || "file";
      if (typeof content !== "string") return;
      const buf = Buffer.from(content, "utf8");
      if (buf.length > TELEGRAM_MAX_DOC_BYTES) return;
      await sendChatAction(chatId, "upload_document").catch(() => {});
      const baseName = String(path).split("/").pop() || "file.txt";
      await sendTelegramDocumentBase64(chatId, buf.toString("base64"), {
        filename: baseName,
        caption: path,
        source: "telegram_sidecar_delivery",
      }).catch(() => {});
    }

    if (toolName === "fs_stat" && result.data?.resolvedPath) {
      const lines = [
        `📄 ${result.data.path}`,
        `Boyut: ${result.data.size} byte`,
        `Tür: ${result.data.isDirectory ? "klasör" : "dosya"}`,
        `Değişti: ${result.data.modifiedAt}`,
      ];
      await sendTelegramWithMarkup(
        chatId,
        lines.join("\n"),
        undefined,
        "telegram_sidecar_fs_stat",
      ).catch(() => {});
    }
  });
}

/** @internal */
export function resetTelegramV9HooksForTests() {
  deliveryHookRegistered = false;
}
