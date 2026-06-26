/**
 * Telegram bot webhook, commands, rate limit, and dev long-polling
 */

import { Router } from "express";
import { getEnvValue } from "../../core/settings/effective-config.js";
import { runChatTurn } from "../../core/chat-orchestrator.js";
import { resolveTelegramChatProfile } from "../../core/chat/chat-profiles.js";
import { auditLog } from "../../core/audit/index.js";
import { BRAND } from "../../core/branding.js";
import {
  sendTelegram,
  sendChatAction,
  replyToChatChunks,
  getTelegramConfig,
  isTelegramConfigured,
} from "./channels/telegram.js";
import {
  getTelegramSession,
  appendTelegramHistory,
} from "./telegram-session.js";
import {
  handleTelegramV7Command,
  handleTelegramCallbackQuery,
  buildTelegramHelpText,
  isHubPaused,
} from "../../core/v7/telegram-commands.js";

const rateLimitBuckets = new Map();

function getRateLimitPerMin() {
  return parseInt(getEnvValue("TELEGRAM_RATE_LIMIT_PER_MIN") || "20", 10);
}

let pollingActive = false;

function getAllowedChatIds() {
  const raw = (getEnvValue("TELEGRAM_ALLOWED_CHAT_IDS") || "").trim();
  if (!raw) return null;
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

function isChatAllowed(chatId) {
  const allowed = getAllowedChatIds();
  if (!allowed || allowed.size === 0) return false;
  return allowed.has(String(chatId));
}

function checkRateLimit(chatId) {
  const key = String(chatId);
  const limit = getRateLimitPerMin();
  const now = Date.now();
  let bucket = rateLimitBuckets.get(key);
  if (!bucket || now - bucket.windowStart > 60_000) {
    bucket = { windowStart: now, count: 0 };
    rateLimitBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export function verifyWebhookSecret(req) {
  const secret = (getEnvValue("TELEGRAM_WEBHOOK_SECRET") || "").trim();
  if (!secret) return false;
  const header = req.headers["x-telegram-bot-api-secret-token"];
  return header === secret;
}

async function auditTelegramTurn(chatId, operation, success, extra = {}) {
  try {
    await auditLog({
      plugin: "notifications",
      operation,
      actor: `telegram:${chatId}`,
      workspaceId: "global",
      allowed: true,
      success,
      metadata: { channel: "telegram", ...extra },
    });
  } catch {
    // non-fatal
  }
}

async function replyToChat(chatId, text) {
  await replyToChatChunks(chatId, text);
}

function toolProgressLabel(toolName) {
  const n = String(toolName || "");
  if (n.startsWith("notion_")) return "Notion'da işlem yapıyorum…";
  if (n.startsWith("tavily")) return "İnternette araştırıyorum…";
  if (n.startsWith("brain_")) return "Bellekte arıyorum…";
  return "İşlem yapıyorum…";
}

/** Only show "Bakıyorum…" if the turn is still running after this delay (ms). */
export const TELEGRAM_WORKING_ACK_DELAY_MS = 2800;

function parseAckDelayMs() {
  const raw = parseInt(getEnvValue("TELEGRAM_WORKING_ACK_DELAY_MS") || "", 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : TELEGRAM_WORKING_ACK_DELAY_MS;
}

/**
 * @param {object} opts
 * @param {() => void | Promise<void>} opts.onAck
 * @param {number} [opts.delayMs]
 */
export function scheduleTelegramWorkingAck({ onAck, delayMs = TELEGRAM_WORKING_ACK_DELAY_MS }) {
  if (delayMs <= 0) {
    return { cancel() {} };
  }
  let cancelled = false;
  const timer = setTimeout(() => {
    if (!cancelled) void onAck();
  }, delayMs);
  return {
    cancel() {
      cancelled = true;
      clearTimeout(timer);
    },
  };
}

function helpText() {
  return buildTelegramHelpText();
}

async function handleCommand(chatId, text) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (lower === "/start") {
    await replyToChat(
      chatId,
      `Merhaba! Ben ${BRAND.assistantName} — ${BRAND.authorName} tarafından geliştirilen ${BRAND.hubName} yardımcı botuyum.\n\n/help ile komutları gör.`
    );
    return { handled: true };
  }

  if (lower === "/help") {
    await replyToChat(chatId, helpText());
    return { handled: true };
  }

  if (lower === "/tools") {
    const { listTools } = await import("../../core/tool-registry.js");
    const count = listTools().length;
    await replyToChat(chatId, `Kayıtlı MCP tool sayısı: ${count}`);
    return { handled: true };
  }

  if (lower.startsWith("/ask")) {
    const question = trimmed.slice(4).trim();
    if (!question) {
      await replyToChat(chatId, "Kullanım: /ask <soru>");
      return { handled: true };
    }
    await processAgentMessage(chatId, question);
    return { handled: true };
  }

  const v7 = await handleTelegramV7Command(chatId, trimmed, {
    reply: (msg) => replyToChat(chatId, msg),
  });
  if (v7.handled) return { handled: true };

  return { handled: false };
}

async function processAgentMessage(chatId, text) {
  if (isHubPaused()) {
    await replyToChat(
      chatId,
      "Hub pause aktif — agent mesajları duraklatıldı. /resume ile devam edin."
    );
    return;
  }

  const rateLimit = getRateLimitPerMin();
  if (!checkRateLimit(chatId)) {
    await replyToChat(chatId, `Rate limit: dakikada en fazla ${rateLimit} kullanıcı mesajı.`);
    await auditTelegramTurn(chatId, "telegram_message", false, { reason: "rate_limit" });
    return;
  }

  const session = await getTelegramSession(chatId);
  const history = session.history || [];
  const chatProfile = resolveTelegramChatProfile();

  await sendChatAction(chatId, "typing");

  let statusSent = false;
  const workingAck = scheduleTelegramWorkingAck({
    delayMs: parseAckDelayMs(),
    onAck: async () => {
      if (statusSent) return;
      statusSent = true;
      await sendChatAction(chatId, "typing");
      await replyToChat(chatId, "Bakıyorum, birazdan yazacağım…");
    },
  });

  try {
    const result = await runChatTurn({
      message: text,
      history,
      includeBrainContext: true,
      allowWriteTools: true,
      chatProfile,
      context: {
        method: "TELEGRAM",
        actor: `telegram:${chatId}`,
        user: `telegram:${chatId}`,
        channel: "telegram",
        scopes: ["read", "write"],
        guardBlocks: [],
      },
      onToolCall: async (payload) => {
        void auditTelegramTurn(chatId, `tool_${payload.name || "unknown"}`, true, {
          phase: payload.phase,
        });
        if (payload.phase === "start" && !statusSent) {
          workingAck.cancel();
          statusSent = true;
          await sendChatAction(chatId, "typing");
          await replyToChat(chatId, toolProgressLabel(payload.name));
        }
      },
    });

    workingAck.cancel();
    const answer =
      result.text ||
      (result.maxIterations
        ? "Yanıt üretilemedi (tool iterasyon limiti)."
        : "Yanıt üretilemedi.");

    await sendChatAction(chatId, "typing");
    await replyToChatChunks(chatId, answer);
    await appendTelegramHistory(chatId, text, answer);
    await auditTelegramTurn(chatId, "telegram_chat_turn", true, {
      iterations: result.iterations,
      toolCount: result.toolCalls?.length || 0,
      chatProfile,
    });
  } catch (err) {
    workingAck.cancel();
    await replyToChat(chatId, `Hata: ${err.message}`);
    await auditTelegramTurn(chatId, "telegram_chat_turn", false, { error: err.message });
  }
}

export async function handleTelegramUpdate(update) {
  if (update?.callback_query) {
    const chatId = update.callback_query.message?.chat?.id;
    if (chatId != null && !isChatAllowed(chatId)) {
      return { ok: false, error: "chat_not_allowed" };
    }
    await handleTelegramCallbackQuery(update.callback_query);
    return { ok: true };
  }

  const message = update?.message;
  if (!message?.text) return { ok: true, skipped: "no_text" };

  const chatId = message.chat?.id;
  if (chatId == null) return { ok: true, skipped: "no_chat" };

  if (!isChatAllowed(chatId)) {
    await auditTelegramTurn(chatId, "telegram_rejected", false, { reason: "not_allowlisted" });
    return { ok: false, error: "chat_not_allowed" };
  }

  const text = message.text;
  const cmd = await handleCommand(chatId, text);
  if (cmd.handled) {
    await auditTelegramTurn(chatId, "telegram_command", true, { command: text.split(/\s/)[0] });
    return { ok: true };
  }

  await processAgentMessage(chatId, text);
  return { ok: true };
}

export function registerTelegramWebhook(app) {
  const router = Router();

  router.post("/telegram/webhook", async (req, res) => {
    if (!verifyWebhookSecret(req)) {
      return res.status(403).json({ ok: false, error: { code: "invalid_webhook_secret" } });
    }

    if (!isTelegramConfigured()) {
      return res.status(503).json({ ok: false, error: { code: "telegram_not_configured" } });
    }

    try {
      const result = await handleTelegramUpdate(req.body);
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: { message: err.message } });
    }
  });

  app.use("/notifications", router);
}

async function pollOnce(offset) {
  const { token } = getTelegramConfig();
  if (!token) return offset;

  const url = `https://api.telegram.org/bot${token}/getUpdates?timeout=25&offset=${offset}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.ok || !Array.isArray(data.result)) return offset;

  let nextOffset = offset;
  for (const update of data.result) {
    nextOffset = Math.max(nextOffset, update.update_id + 1);
    await handleTelegramUpdate(update);
  }
  return nextOffset;
}

export function startTelegramPolling() {
  if (pollingActive) return;
  if (process.env.TELEGRAM_POLLING !== "true") return;
  if (!isTelegramConfigured()) {
    console.warn("[telegram] TELEGRAM_POLLING=true but bot not configured");
    return;
  }

  pollingActive = true;
  let offset = 0;
  console.log("[telegram] Long polling started (dev mode)");

  const loop = async () => {
    while (pollingActive) {
      try {
        offset = await pollOnce(offset);
      } catch (err) {
        console.warn("[telegram] Polling error:", err.message);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  };

  void loop();
}

export function stopTelegramPolling() {
  pollingActive = false;
}
