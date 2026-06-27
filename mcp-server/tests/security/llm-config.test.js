/**
 * LLM config — production must not use auto provider.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("llm-config production explicit", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("getResolvedChatProvider throws in production when provider is auto", async () => {
    delete process.env.VITEST;
    process.env.NODE_ENV = "production";
    process.env.HUB_READ_KEY = "read-key-for-llm-security-test-xx";
    process.env.HUB_WRITE_KEY = "write-key-for-llm-security-test-x";
    process.env.HUB_ADMIN_KEY = "admin-key-for-llm-security-test-x";
    process.env.CHAT_LLM_PROVIDER = "auto";
    const { getResolvedChatProvider } = await import("../../src/core/llm-config.js");
    expect(() => getResolvedChatProvider()).toThrow(/explicit/i);
  });

  it("getResolvedChatProvider returns explicit provider in production", async () => {
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    process.env.NODE_ENV = "production";
    process.env.HUB_READ_KEY = "read-key-for-llm-security-test-xx";
    process.env.HUB_WRITE_KEY = "write-key-for-llm-security-test-x";
    process.env.HUB_ADMIN_KEY = "admin-key-for-llm-security-test-x";
    process.env.CHAT_LLM_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";
    const { getResolvedChatProvider } = await import("../../src/core/llm-config.js");
    expect(getResolvedChatProvider()).toBe("openai");
    vi.restoreAllMocks();
  });
});
