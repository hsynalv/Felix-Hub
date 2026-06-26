import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "../../src/core/auth/password.js";

describe("auth password", () => {
  it("hashes and verifies password", async () => {
    const hash = await hashPassword("Hasanalav.1896");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Hasanalav.1896", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("enforces minimum length", () => {
    expect(validatePasswordPolicy("short").ok).toBe(false);
    expect(validatePasswordPolicy("longenough").ok).toBe(true);
  });
});
