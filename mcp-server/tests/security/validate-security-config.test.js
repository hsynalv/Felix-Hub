/**
 * Production security validation — fail-closed startup rules.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("validateSecurityConfigOrExit — production", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...envBackup };
    delete process.env.VITEST;
    process.env.NODE_ENV = "production";
    process.env.HUB_READ_KEY = "read-key-for-security-tests-xxx";
    process.env.HUB_WRITE_KEY = "write-key-for-security-tests-xx";
    process.env.HUB_ADMIN_KEY = "admin-key-for-security-tests-xx";
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
    process.env.WORKSPACE_STRICT_BOUNDARIES = "true";
    process.env.WORKSPACE_REQUIRE_ID = "true";
    process.env.CHAT_LLM_PROVIDER = "openai";
    process.env.CHAT_LLM_MODEL = "gpt-4o-mini";
    process.env.SHELL_MODE = "safe";
    delete process.env.HUB_ALLOW_OPEN_HUB;
    delete process.env.POLICY_ALLOW_MISSING_EVALUATOR;
    delete process.env.TOOL_POLICY_ALLOW_MISSING_EVALUATOR;
    delete process.env.POLICY_GUARD_ALLOW_MISSING_EVALUATOR;
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
  });

  afterEach(() => {
    process.env = envBackup;
    vi.restoreAllMocks();
  });

  async function loadValidator() {
    const mod = await import("../../src/core/security/validate-security-config.js");
    return mod.validateSecurityConfigOrExit;
  }

  it("passes with a valid production configuration", async () => {
    const validate = await loadValidator();
    expect(() => validate()).not.toThrow();
  });

  it("exits when CORS_ALLOWED_ORIGINS is missing", async () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    const validate = await loadValidator();
    expect(() => validate()).toThrow("process.exit");
  });

  it("exits when CHAT_LLM_PROVIDER is auto", async () => {
    process.env.CHAT_LLM_PROVIDER = "auto";
    const validate = await loadValidator();
    expect(() => validate()).toThrow("process.exit");
  });

  it("exits when policy fail-open flags are set", async () => {
    process.env.POLICY_ALLOW_MISSING_EVALUATOR = "true";
    const validate = await loadValidator();
    expect(() => validate()).toThrow("process.exit");
  });

  it("exits when WORKSPACE_STRICT_BOUNDARIES is not true", async () => {
    process.env.WORKSPACE_STRICT_BOUNDARIES = "false";
    const validate = await loadValidator();
    expect(() => validate()).toThrow("process.exit");
  });
});

describe("validateSecurityConfigOrExit — test env skip", () => {
  it("skips validation when VITEST is true", async () => {
    process.env.VITEST = "true";
    process.env.NODE_ENV = "production";
    delete process.env.CORS_ALLOWED_ORIGINS;
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    const { validateSecurityConfigOrExit } = await import(
      "../../src/core/security/validate-security-config.js"
    );
    expect(() => validateSecurityConfigOrExit()).not.toThrow();
    vi.restoreAllMocks();
  });
});
