import { describe, it, expect } from "vitest";
import {
  assertDesktopActionAllowed,
  detectSensitiveContext,
} from "../../src/plugins/local-sidecar/desktop-guard.js";

describe("v10 desktop guard — faz C", () => {
  it("blocks click on login screen", () => {
    const r = assertDesktopActionAllowed({
      action: "click",
      app: "Google Chrome",
      title: "Sign in to your account",
      x: 100,
      y: 200,
    });
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe("sensitive_context");
  });

  it("blocks clipboard_read on blocked app", () => {
    const r = assertDesktopActionAllowed({
      action: "clipboard_read",
      app: "1Password",
      title: "Vault",
    });
    expect(r.ok).toBe(false);
  });

  it("blocks hotkey on payment context", () => {
    const r = assertDesktopActionAllowed({
      action: "hotkey",
      app: "Safari",
      title: "Payment checkout",
    });
    expect(r.ok).toBe(false);
    expect(detectSensitiveContext({ title: "Payment checkout" }).sensitive).toBe(true);
  });

  it("allows scroll in Finder", () => {
    const r = assertDesktopActionAllowed({
      action: "scroll",
      app: "Finder",
      title: "Documents",
      x: 400,
      y: 400,
    });
    expect(r.ok).toBe(true);
  });
});
