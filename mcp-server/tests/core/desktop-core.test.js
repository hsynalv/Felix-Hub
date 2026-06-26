/**
 * Desktop core unit tests (stub paths on non-macOS CI).
 */

import { describe, it, expect } from "vitest";
import { getActiveWindow, ocrScreenRegion } from "../../src/plugins/local-sidecar/desktop.core.js";

describe("desktop.core", () => {
  it("getActiveWindow returns structured response", async () => {
    const result = await getActiveWindow();
    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.platform).toBe(process.platform);
  });

  it("ocrScreenRegion requires imageBase64", async () => {
    const missing = await ocrScreenRegion({});
    expect(missing.ok).toBe(false);
    expect(missing.error?.code).toBe("missing_image");
  });

  it("ocrScreenRegion accepts base64 payload", async () => {
    const buf = Buffer.from("fake-image");
    const result = await ocrScreenRegion({ imageBase64: buf.toString("base64") });
    if (result.ok) {
      expect(result.data.byteLength).toBe(buf.length);
    } else {
      expect(result.error?.code).toBe("ocr_failed");
    }
  });
});
