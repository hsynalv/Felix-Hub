/**
 * LLM config unit tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getLlmKeyMode,
  getUnifiedApiKey,
  getProviderApiKey,
  getChatProviderPreference,
  getRouterProviderPreference,
  getResolvedChatProvider,
  isProviderKeyConfigured,
} from "../../src/core/llm-config.js";
import { setOverlayEntry, deleteOverlayEntry } from "../../src/core/settings/effective-config.js";

describe("llm-config", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    for (const key of [
      "LLM_KEY_MODE",
      "LLM_UNIFIED_API_KEY",
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "CHAT_LLM_PROVIDER",
      "ROUTER_LLM_PROVIDER",
      "VLLM_BASE_URL",
    ]) {
      deleteOverlayEntry(key);
      delete process.env[key];
    }
  });

  it("defaults to split mode", () => {
    expect(getLlmKeyMode()).toBe("split");
  });

  it("unified mode forces openai for chat and router", () => {
    setOverlayEntry("LLM_KEY_MODE", "unified");
    setOverlayEntry("LLM_UNIFIED_API_KEY", "sk-unified");
    process.env.LLM_KEY_MODE = "unified";
    process.env.LLM_UNIFIED_API_KEY = "sk-unified";

    expect(getChatProviderPreference()).toBe("openai");
    expect(getRouterProviderPreference()).toBe("openai");
    expect(getUnifiedApiKey()).toBe("sk-unified");
    expect(getProviderApiKey("openai")).toBe("sk-unified");
    expect(getProviderApiKey("anthropic")).toBe("");
    expect(isProviderKeyConfigured("openai")).toBe(true);
    expect(isProviderKeyConfigured("anthropic")).toBe(false);
  });

  it("split mode allows separate chat and router assignment", () => {
    setOverlayEntry("LLM_KEY_MODE", "split");
    setOverlayEntry("CHAT_LLM_PROVIDER", "openai");
    setOverlayEntry("ROUTER_LLM_PROVIDER", "anthropic");
    setOverlayEntry("OPENAI_API_KEY", "sk-openai");
    setOverlayEntry("ANTHROPIC_API_KEY", "sk-ant");
    process.env.LLM_KEY_MODE = "split";
    process.env.CHAT_LLM_PROVIDER = "openai";
    process.env.ROUTER_LLM_PROVIDER = "anthropic";
    process.env.OPENAI_API_KEY = "sk-openai";
    process.env.ANTHROPIC_API_KEY = "sk-ant";

    expect(getChatProviderPreference()).toBe("openai");
    expect(getRouterProviderPreference()).toBe("anthropic");
    expect(getResolvedChatProvider()).toBe("openai");
    expect(getProviderApiKey("anthropic")).toBe("sk-ant");
  });
});
