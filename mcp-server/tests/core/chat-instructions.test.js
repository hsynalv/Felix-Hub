import { describe, it, expect, afterEach } from "vitest";
import {
  buildInstructionsBlock,
  getGlobalChatInstructions,
} from "../../src/core/chat/chat-instructions.js";
import { applyOverlayEntry } from "../../src/core/settings/effective-config.js";

describe("chat-instructions", () => {
  afterEach(() => {
    applyOverlayEntry("CHAT_GLOBAL_INSTRUCTIONS", "");
  });

  it("layers global before conversation instructions", () => {
    applyOverlayEntry("CHAT_GLOBAL_INSTRUCTIONS", "Global kural.");
    const block = buildInstructionsBlock(
      { instructions: "Sohbet talimatı." },
      undefined,
      undefined
    );
    expect(block.indexOf("Global kural.")).toBeLessThan(block.indexOf("Sohbet talimatı."));
    expect(block).toContain("Global kural.");
    expect(block).toContain("Sohbet talimatı.");
  });

  it("explicit systemPrompt overrides conversation metadata", () => {
    applyOverlayEntry("CHAT_GLOBAL_INSTRUCTIONS", "Global.");
    const block = buildInstructionsBlock(
      { instructions: "Metadata." },
      "Request override.",
      undefined
    );
    expect(block).toContain("Global.");
    expect(block).toContain("Request override.");
    expect(block).not.toContain("Metadata.");
  });

  it("appends response style suffix", () => {
    const block = buildInstructionsBlock({}, undefined, "concise");
    expect(block).toContain("kısa ve öz");
  });

  it("getGlobalChatInstructions reads overlay", () => {
    applyOverlayEntry("CHAT_GLOBAL_INSTRUCTIONS", "  test  ");
    expect(getGlobalChatInstructions()).toBe("test");
  });
});
