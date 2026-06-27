import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/plugins/notifications/channels/telegram.js", () => ({
  sendTelegramWithMarkup: vi.fn().mockResolvedValue({ ok: true }),
  sendTelegramPhotoBase64: vi.fn().mockResolvedValue({ ok: true }),
  sendTelegramDocumentBase64: vi.fn().mockResolvedValue({ ok: true }),
  sendChatAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/core/chat-orchestrator.js", () => ({
  resolveChatApproval: vi.fn(),
}));

import { sendTelegramWithMarkup } from "../../src/plugins/notifications/channels/telegram.js";
import { resolveChatApproval } from "../../src/core/chat-orchestrator.js";
import {
  createTelegramOnApproval,
  resolveTelegramToolApproval,
  deliverSidecarScreenshotToTelegram,
  resetTelegramV9HooksForTests,
} from "../../src/core/v9/telegram-agent-session.js";

describe("v9 telegram agent session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTelegramV9HooksForTests();
  });

  it("createTelegramOnApproval sends inline keyboard", async () => {
    const reply = vi.fn();
    const onApproval = createTelegramOnApproval("12345", reply);
    await onApproval({
      approvalId: "apr-1",
      tool: "fs_write",
      arguments: { path: "~/test.txt", explanation: "test dosyası" },
      message: "write needed",
    });

    expect(sendTelegramWithMarkup).toHaveBeenCalledWith(
      "12345",
      expect.stringContaining("Onay gerekli"),
      expect.objectContaining({
        inline_keyboard: [
          [
            { text: "Onayla", callback_data: "tapprove:apr-1" },
            { text: "Reddet", callback_data: "tdeny:apr-1" },
          ],
        ],
      }),
      "telegram_agent_approval",
    );
    expect(reply).not.toHaveBeenCalled();
  });

  it("resolveTelegramToolApproval delegates to resolveChatApproval", async () => {
    resolveChatApproval.mockResolvedValue({ status: "approved" });
    const result = await resolveTelegramToolApproval("apr-2", true);
    expect(resolveChatApproval).toHaveBeenCalledWith("apr-2", true);
    expect(result).toEqual({ status: "approved" });
  });

  it("deliverSidecarScreenshotToTelegram sends photo", async () => {
    const { sendTelegramPhotoBase64 } = await import("../../src/plugins/notifications/channels/telegram.js");
    const result = await deliverSidecarScreenshotToTelegram("12345", "desktop_screenshot", {
      ok: true,
      data: { format: "png", imageBase64: Buffer.from("hello").toString("base64"), width: 100, height: 50 },
    });
    expect(result.delivered).toBe(true);
    expect(sendTelegramPhotoBase64).toHaveBeenCalled();
  });
});
