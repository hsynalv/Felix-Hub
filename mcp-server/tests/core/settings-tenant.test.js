import { describe, it, expect } from "vitest";
import { userNamespaceForId } from "../../src/core/auth/request-context.js";
import { resolveSettingsNamespace } from "../../src/core/auth/tenant-middleware.js";

describe("tenant namespace", () => {
  it("builds user namespace from id", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(userNamespaceForId(id)).toBe(`user:${id}`);
  });

  it("resolveSettingsNamespace prefers session user", () => {
    const req = {
      user: { namespace: "user:abc" },
      query: { namespace: "default" },
    };
    expect(resolveSettingsNamespace(req)).toBe("user:abc");
  });

  it("resolveSettingsNamespace falls back to query", () => {
    const req = { query: { namespace: "custom" } };
    expect(resolveSettingsNamespace(req)).toBe("custom");
  });
});
