/**
 * Shell command audit redaction.
 */

import { describe, it, expect } from "vitest";
import { redactShellCommand } from "../../src/core/security/redact-shell-command.js";

describe("redactShellCommand", () => {
  it("redacts password flags and env assignments", () => {
    const cmd = 'curl -u user --password secret123 token=abc123';
    const out = redactShellCommand(cmd);
    expect(out).not.toContain("secret123");
    expect(out).not.toContain("abc123");
    expect(out).toMatch(/password \*\*\*/i);
  });

  it("redacts Bearer tokens and API keys", () => {
    const cmd = "curl -H 'Authorization: Bearer sk-live-abcdefghijklmnop' https://api.example.com";
    const out = redactShellCommand(cmd);
    expect(out).not.toContain("sk-live");
    expect(out).toMatch(/Bearer \*\*\*/);
  });

  it("redacts connection strings", () => {
    const cmd = "psql postgres://user:pass@host/db";
    const out = redactShellCommand(cmd);
    expect(out).not.toContain("user:pass");
    expect(out).toMatch(/postgres:\/\/\*\*\*/);
  });
});
