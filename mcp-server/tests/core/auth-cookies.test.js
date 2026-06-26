import { describe, it, expect } from "vitest";
import { parseCookies, SESSION_COOKIE, REFRESH_COOKIE } from "../../src/core/auth/cookies.js";

describe("auth cookies", () => {
  it("parses cookie header", () => {
    const cookies = parseCookies(`${SESSION_COOKIE}=abc123; ${REFRESH_COOKIE}=def456`);
    expect(cookies[SESSION_COOKIE]).toBe("abc123");
    expect(cookies[REFRESH_COOKIE]).toBe("def456");
  });

  it("returns empty for missing header", () => {
    expect(parseCookies("")).toEqual({});
  });
});
