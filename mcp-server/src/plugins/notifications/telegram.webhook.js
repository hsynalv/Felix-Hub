/**
 * Telegram bot webhook, commands, rate limit, and dev long-polling
 */

import { Router } from "express";
import { getEnvValue } from "../../core/settings/effective-config.js";
import { runChatTurn } from "../../core/chat-orchestrator.js";
import { auditLog } from "../../core/audit/index.js";
import { sendTelegram, getTelegramConfig, isTelegramConfigured } from "./channels/telegram.js";
import {
  getTelegramSession,
  appendTelegramHistory,
} from "./telegram-session.js";

const rateLimitBuckets = new Map();
const RATE_LIMIT_PER_MIN = parseInt(process.env.TELEGRAM_RATE_LIMIT_PER_MIN || "10", 10);

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
  const now = Date.now();
  let bucket = rateLimitBuckets.get(key);
  if (!bucket || now - bucket.windowStart > 60_000) {
    bucket = { windowStart: now, count: 0 };
    rateLimitBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_PER_MIN;
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
  await sendTelegram({
    message: text.slice(0, 4000),
    chatId: String(chatId),
  });
}

function helpText() {
  return [
    "mcp-hub Telegram bot",
    "",
    "/start — karşılama",
    "/help — bu mesaj",
    "/tools — kullanılabilir araç sayısı",
    "/ask <soru> — hub agent'a sor",
    "",
    "Serbest metin de soru olarak işlenir (read-only tools).",
  ].join("\n");
}

async function handleCommand(chatId, text) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (lower === "/start") {
    await replyToChat(chatId, "Merhaba! mcp-hub Telegram bot aktif.\n\n/help ile komutları gör.");
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

  return { handled: false };
}

async function processAgentMessage(chatId, text) {
  if (!checkRateLimit(chatId)) {
    await replyToChat(chatId, "Rate limit: dakikada en fazla " + RATE_LIMIT_PER_MIN + " mesaj.");
    await auditTelegramTurn(chatId, "telegram_message", false, { reason: "rate_limit" });
    return;
  }

  const session = await getTelegramSession(chatId);
  const history = session.history || [];

  try {
    const result = await runChatTurn({
      message: text,
      history,
      includeBrainContext: true,
      allowWriteTools: false,
      context: {
        method: "TELEGRAM",
        actor: `telegram:${chatId}`,
        user: `telegram:${chatId}`,
        channel: "telegram",
        scopes: ["read"],
      },
      onToolCall: (payload) => {
        void auditTelegramTurn(chatId, `tool_${payload.name || "unknown"}`, true, {
          phase: payload.phase,
        });
      },
    });

    const answer =
      result.text ||
      (result.maxIterations
        ? "Yanıt üretilemedi (tool iterasyon limiti)."
        : "Yanıt üretilemedi.");

    await replyToChat(chatId, answer);
    await appendTelegramHistory(chatId, text, answer);
    await auditTelegramTurn(chatId, "telegram_chat_turn", true, {
      iterations: result.iterations,
      toolCount: result.toolCalls?.length || 0,
    });
  } catch (err) {
    await replyToChat(chatId, `Hata: ${err.message}`);
    await auditTelegramTurn(chatId, "telegram_chat_turn", false, { error: err.message });
  }
}

export async function handleTelegramUpdate(update) {
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
