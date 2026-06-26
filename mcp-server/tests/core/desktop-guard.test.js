/**
 * Desktop guard unit tests.
 */

import { describe, it, expect } from "vitest";
import {
  assertDesktopActionAllowed,
  detectSensitiveContext,
  isAppAllowed,
  validateCoordinates,
} from "../../src/plugins/local-sidecar/desktop-guard.js";

describe("desktop-guard", () => {
  it("blocks sensitive login titles", () => {
    const r = detectSensitiveContext({ app: "Safari", title: "Sign in to your account" });
    expect(r.sensitive).toBe(true);
  });

  it("blocks payment screens", () => {
    const r = detectSensitiveContext({ app: "Chrome", title: "Checkout - Payment" });
    expect(r.sensitive).toBe(true);
  });

  it("rejects out-of-bounds coordinates", () => {
    const r = validateCoordinates({ x: -1, y: 10 });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe("coords_out_of_bounds");
  });

  it("blocks click on sensitive context", () => {
    const r = assertDesktopActionAllowed({
      action: "click",
      app: "Safari",
      title: "Enter password",
      x: 100,
      y: 200,
    });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe("sensitive_context");
    expect(r.error?.preview).toMatchObject({ x: 100, y: 200 });
  });

  it("allows click on safe app with valid coords", () => {
    const prev = process.env.DESKTOP_ALLOWLIST_DISABLED;
    process.env.DESKTOP_ALLOWLIST_DISABLED = "true";
    const r = assertDesktopActionAllowed({
      action: "click",
      app: "Cursor",
      title: "workflow-executor.js",
      x: 50,
      y: 80,
    });
    if (prev === undefined) delete process.env.DESKTOP_ALLOWLIST_DISABLED;
    else process.env.DESKTOP_ALLOWLIST_DISABLED = prev;
    expect(r.ok).toBe(true);
    expect(r.data.preview).toMatchObject({ x: 50, y: 80, app: "Cursor" });
  });

  it("enforces app allowlist when enabled", () => {
    const r = assertDesktopActionAllowed({
      action: "type",
      app: "UnknownMalwareApp",
      title: "Editor",
    });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe("app_not_allowlisted");
  });
});
