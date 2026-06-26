import { describe, it, expect, vi, beforeEach } from "vitest";
import { shouldAutoApproveTelegramTool, getTelegramAutoApproveTools } from "../../src/core/chat/telegram-auto-approve.js";
import { applyOverlayEntry } from "../../src/core/settings/effective-config.js";

describe("telegram-auto-approve", () => {
  beforeEach(() => {
    applyOverlayEntry("TELEGRAM_ALLOWED_CHAT_IDS", "12345");
    applyOverlayEntry("TELEGRAM_AUTO_APPROVE_TOOLS", "");
  });

  it("includes default notion write tools", () => {
    const tools = getTelegramAutoApproveTools();
    expect(tools.has("notion_setup_project")).toBe(true);
    expect(tools.has("notion_add_row")).toBe(true);
  });

  it("auto-approves for allowlisted telegram chat and notion tool", () => {
    expect(
      shouldAutoApproveTelegramTool(
        { channel: "telegram", actor: "telegram:12345" },
        "notion_setup_project"
      )
    ).toBe(true);
  });

  it("rejects non-telegram channel", () => {
    expect(
      shouldAutoApproveTelegramTool(
        { channel: "web", actor: "telegram:12345" },
        "notion_setup_project"
      )
    ).toBe(false);
  });

  it("rejects non-allowlisted chat", () => {
    expect(
      shouldAutoApproveTelegramTool(
        { channel: "telegram", actor: "telegram:99999" },
        "notion_setup_project"
      )
    ).toBe(false);
  });

  it("rejects shell tools", () => {
    expect(
      shouldAutoApproveTelegramTool(
        { channel: "telegram", actor: "telegram:12345" },
        "shell_execute"
      )
    ).toBe(false);
  });
});
