/**
 * Telegram channel + notifications_send tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  escapeMarkdownV2,
  formatMarkdownV2,
  isTelegramConfigured,
  sendTelegram,
} from "../../src/plugins/notifications/channels/telegram.js";
import * as notifications from "../../src/plugins/notifications/index.js";

describe("Telegram channel", () => {
  beforeEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it("escapeMarkdownV2 escapes special characters", () => {
    expect(escapeMarkdownV2("hello.world")).toBe("hello\\.world");
    expect(escapeMarkdownV2("a_b")).toBe("a\\_b");
  });

  it("formatMarkdownV2 bolds title", () => {
    const text = formatMarkdownV2("Title", "body");
    expect(text).toContain("*Title*");
    expect(text).toContain("body");
  });

  it("isTelegramConfigured false without env", () => {
    expect(isTelegramConfigured()).toBe(false);
  });

  it("isTelegramConfigured true with token and chat id", () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    process.env.TELEGRAM_CHAT_ID = "999";
    expect(isTelegramConfigured()).toBe(true);
  });

  it("sendTelegram throws when not configured", async () => {
    await expect(sendTelegram({ message: "hi" })).rejects.toThrow(/not configured/i);
  });

  it("sendTelegram maps 401 to invalid token", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "bad";
    process.env.TELEGRAM_CHAT_ID = "1";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, description: "Unauthorized" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendTelegram({ message: "test" })).rejects.toThrow(/invalid.*token/i);
    vi.unstubAllGlobals();
  });

  it("sendTelegram succeeds on ok response", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    process.env.TELEGRAM_CHAT_ID = "42";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 7 } }),
      })
    );

    const result = await sendTelegram({ title: "T", message: "M" });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe(7);
    vi.unstubAllGlobals();
  });
});

describe("notifications_send tool", () => {
  it("exists in plugin tools", () => {
    const tool = notifications.tools.find((t) => t.name === "notifications_send");
    expect(tool).toBeDefined();
  });

  it("requires title and message", async () => {
    const tool = notifications.tools.find((t) => t.name === "notifications_send");
    const result = await tool.handler({ title: "x" });
    expect(result.ok).toBe(false);
  });

  it("notifications_list_channels returns channel list", async () => {
    const tool = notifications.tools.find((t) => t.name === "notifications_list_channels");
    const result = await tool.handler({});
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.data.channels)).toBe(true);
  });
});

describe("Telegram webhook security", () => {
  afterEach(() => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  });

  it("verifyWebhookSecret rejects when secret is not configured", async () => {
    const { verifyWebhookSecret } = await import(
      "../../src/plugins/notifications/telegram.webhook.js"
    );
    const req = { headers: { "x-telegram-bot-api-secret-token": "any" } };
    expect(verifyWebhookSecret(req)).toBe(false);
  });

  it("verifyWebhookSecret rejects wrong header", async () => {
    const { verifyWebhookSecret } = await import(
      "../../src/plugins/notifications/telegram.webhook.js"
    );
    process.env.TELEGRAM_WEBHOOK_SECRET = "expected-secret";
    const req = { headers: { "x-telegram-bot-api-secret-token": "wrong" } };
    expect(verifyWebhookSecret(req)).toBe(false);
  });

  it("verifyWebhookSecret accepts matching header", async () => {
    const { verifyWebhookSecret } = await import(
      "../../src/plugins/notifications/telegram.webhook.js"
    );
    process.env.TELEGRAM_WEBHOOK_SECRET = "expected-secret";
    const req = { headers: { "x-telegram-bot-api-secret-token": "expected-secret" } };
    expect(verifyWebhookSecret(req)).toBe(true);
  });

  it("handleTelegramUpdate rejects non-allowlisted chat", async () => {
    const { handleTelegramUpdate } = await import(
      "../../src/plugins/notifications/telegram.webhook.js"
    );
    process.env.TELEGRAM_BOT_TOKEN = "1:token";
    process.env.TELEGRAM_CHAT_ID = "1";
    process.env.TELEGRAM_ALLOWED_CHAT_IDS = "111";

    const result = await handleTelegramUpdate({
      message: { text: "hello", chat: { id: 999 } },
    });
    expect(result.error).toBe("chat_not_allowed");
  });
});
