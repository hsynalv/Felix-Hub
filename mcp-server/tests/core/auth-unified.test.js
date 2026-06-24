/**
 * Unified auth — API key + UI token parity
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  resolveApiKeyOrUiToken,
  authenticateRequest,
  validateBearerToken,
  isAuthEnabled,
} from "../../src/core/auth.js";

describe("Unified auth", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.HUB_READ_KEY = "read-key-1234567890";
    process.env.HUB_WRITE_KEY = "write-key-1234567890";
    process.env.HUB_ADMIN_KEY = "admin-key-1234567890";
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it("resolveApiKeyOrUiToken returns read scopes for read key", () => {
    const result = resolveApiKeyOrUiToken("read-key-1234567890");
    expect(result.valid).toBe(true);
    expect(result.scopes).toEqual(["read"]);
    expect(result.type).toBe("api_key");
  });

  it("resolveApiKeyOrUiToken returns admin scopes for admin key", () => {
    const result = resolveApiKeyOrUiToken("admin-key-1234567890");
    expect(result.valid).toBe(true);
    expect(result.scopes).toContain("admin");
  });

  it("authenticateRequest populates scopes from bearer token", () => {
    const req = {
      headers: { authorization: "Bearer write-key-1234567890" },
    };
    const auth = authenticateRequest(req);
    expect(auth.authenticated).toBe(true);
    expect(auth.scopes).toContain("write");
    expect(auth.actor?.type).toBe("api_key");
  });

  it("validateBearerToken matches authenticateRequest for API keys", async () => {
    const token = "admin-key-1234567890";
    const bearer = await validateBearerToken(token);
    expect(bearer.valid).toBe(true);
    expect(bearer.scopes).toContain("admin");
  });

  it("isAuthEnabled when keys configured", () => {
    expect(isAuthEnabled()).toBe(true);
  });
});
