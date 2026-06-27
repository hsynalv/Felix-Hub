import { describe, it, expect } from "vitest";
import {
  buildScreenshotAttachment,
  redactBinaryFieldsFromToolResult,
  sanitizeToolStreamPayload,
} from "../../src/core/chat/tool-result-media.js";

describe("tool-result-media", () => {
  it("builds image attachment dataUrl", () => {
    const attachment = buildScreenshotAttachment("desktop_screenshot", {
      ok: true,
      data: { format: "png", width: 100, height: 50, imageBase64: "aGVsbG8=" },
    });
    expect(attachment?.kind).toBe("image");
    expect(attachment?.dataUrl).toBe("data:image/png;base64,aGVsbG8=");
    expect(attachment?.caption).toContain("100×50");
  });

  it("redacts binary fields from tool result", () => {
    const redacted = redactBinaryFieldsFromToolResult({
      ok: true,
      data: { imageBase64: "secret", width: 1 },
    });
    expect(redacted.data.imageBase64).toBe("[redacted:image]");
    expect(redacted.data.width).toBe(1);
  });

  it("sanitizes screenshot tool stream payload", () => {
    const payload = sanitizeToolStreamPayload({
      phase: "end",
      name: "desktop_screenshot",
      result: { ok: true, data: { imageBase64: "secret" } },
    });
    expect(payload.result.data.imageBase64).toBe("[redacted:image]");
  });
});
