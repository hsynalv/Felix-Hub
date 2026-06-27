import { describe, it, expect } from "vitest";
import {
  classifyBrowserUrl,
  assertBrowserActionAllowed,
} from "../../src/plugins/local-sidecar/browser-guard.js";

describe("v10 browser guard", () => {
  it("blocks file:// URLs", () => {
    const r = classifyBrowserUrl("file:///etc/passwd");
    expect(r.classification).toBe("blocked");
  });

  it("flags checkout URLs as sensitive", () => {
    const r = classifyBrowserUrl("https://shop.example.com/checkout/pay");
    expect(r.classification).toBe("sensitive");
  });

  it("allows normal product pages", () => {
    const r = classifyBrowserUrl("https://example.com/products/widget");
    expect(r.classification).toBe("normal");
  });

  it("hard-stops browser_click on login URL", () => {
    const r = assertBrowserActionAllowed({
      action: "click",
      url: "https://bank.example.com/login",
    });
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe("browser_sensitive_hard_stop");
  });

  it("allows browser_open on normal URL", () => {
    const r = assertBrowserActionAllowed({
      action: "open",
      url: "https://news.ycombinator.com",
    });
    expect(r.ok).toBe(true);
  });
});
