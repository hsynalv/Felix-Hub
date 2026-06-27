import { describe, expect, it } from "vitest";
import { isPublicSecurityPath } from "../../src/core/security/public-http-paths.js";

function req(method, path, accept) {
  return { method, path, headers: { accept } };
}

describe("isPublicSecurityPath — SPA shell", () => {
  it("allows HTML navigation to landing and login", () => {
    const html = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
    expect(isPublicSecurityPath(req("GET", "/", html))).toBe(true);
    expect(isPublicSecurityPath(req("GET", "/login", html))).toBe(true);
    expect(isPublicSecurityPath(req("GET", "/register", html))).toBe(true);
    expect(isPublicSecurityPath(req("GET", "/today", html))).toBe(true);
    expect(isPublicSecurityPath(req("GET", "/chat", html))).toBe(true);
  });

  it("still requires auth for JSON API fetches", () => {
    expect(isPublicSecurityPath(req("GET", "/whoami", "application/json"))).toBe(false);
    expect(isPublicSecurityPath(req("GET", "/tools", "application/json"))).toBe(false);
    expect(isPublicSecurityPath(req("GET", "/audit/logs", "application/json"))).toBe(false);
  });

  it("allows session probe on /auth/me", () => {
    expect(isPublicSecurityPath(req("GET", "/auth/me", "application/json"))).toBe(true);
  });

  it("treats wildcard Accept as browser navigation", () => {
    expect(isPublicSecurityPath(req("GET", "/login", "*/*"))).toBe(true);
  });

  it("treats API roots as JSON-only (not public HTML bypass)", () => {
    const html = "text/html,application/xhtml+xml";
    expect(isPublicSecurityPath(req("GET", "/jobs", html))).toBe(false);
    expect(isPublicSecurityPath(req("GET", "/plugins", html))).toBe(false);
    expect(isPublicSecurityPath(req("GET", "/projects/foo/command-center", html))).toBe(false);
  });

  it("allows Telegram webhook POST without hub auth", () => {
    expect(isPublicSecurityPath(req("POST", "/notifications/telegram/webhook", "application/json"))).toBe(
      true
    );
  });
});
