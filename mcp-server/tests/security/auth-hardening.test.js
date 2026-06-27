/**
 * Auth hardening — query tokens removed, UI token scopes narrowed.
 */

import { describe, it, expect } from "vitest";
import { extractAuthKey } from "../../src/core/auth.js";
import { resolveApiKeyOrUiToken } from "../../src/core/auth.js";
import { issueUiToken } from "../../src/core/ui-tokens.js";

describe("auth hardening", () => {
  it("extractAuthKey ignores query string tokens", () => {
    const req = {
      headers: {},
      query: { access_token: "secret-from-query", token: "also-secret" },
    };
    expect(extractAuthKey(req)).toBeNull();
  });

  it("extractAuthKey reads Bearer header", () => {
    const req = { headers: { authorization: "Bearer hub-read-key" } };
    expect(extractAuthKey(req)).toBe("hub-read-key");
  });

  it("extractAuthKey reads x-hub-api-key header", () => {
    const req = { headers: { "x-hub-api-key": "hub-key" } };
    expect(extractAuthKey(req)).toBe("hub-key");
  });

  it("UI token resolves to read+write only (no admin)", () => {
    const { token } = issueUiToken();
    const resolved = resolveApiKeyOrUiToken(token);
    expect(resolved.valid).toBe(true);
    expect(resolved.scopes).toEqual(["read", "write"]);
    expect(resolved.scopes).not.toContain("admin");
  });
});
