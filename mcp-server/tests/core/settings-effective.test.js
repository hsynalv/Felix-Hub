/**
 * Effective config overlay tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setOverlayEntry,
  deleteOverlayEntry,
  getEnvValue,
  getEffectiveConfig,
  getEffectiveConfigMasked,
  listOverlayKeys,
  RESTART_REQUIRED_KEYS,
  HOT_RELOAD_KEYS,
} from "../../src/core/settings/effective-config.js";

describe("settings/effective-config", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    for (const key of listOverlayKeys()) {
      deleteOverlayEntry(key);
    }
  });

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.NOTION_API_KEY;
  });

  it("getEnvValue prefers overlay over process.env", () => {
    process.env.OPENAI_API_KEY = "from-env";
    setOverlayEntry("OPENAI_API_KEY", "from-overlay");
    expect(getEnvValue("OPENAI_API_KEY")).toBe("from-overlay");
  });

  it("getEnvValue falls back to process.env", () => {
    process.env.NOTION_API_KEY = "notion-env";
    expect(getEnvValue("NOTION_API_KEY")).toBe("notion-env");
  });

  it("deleteOverlayEntry removes overlay entry", () => {
    const key = "TEST_OVERLAY_KEY_UNIQUE";
    delete process.env[key];
    setOverlayEntry(key, "tok");
    deleteOverlayEntry(key);
    expect(getEnvValue(key)).toBeUndefined();
  });

  it("getEffectiveConfig merges notion from overlay", () => {
    setOverlayEntry("NOTION_API_KEY", "overlay-notion");
    const cfg = getEffectiveConfig();
    expect(cfg.notion.apiKey).toBe("overlay-notion");
  });

  it("getEffectiveConfigMasked does not expose raw secrets", () => {
    setOverlayEntry("OPENAI_API_KEY", "sk-super-secret-key-value");
    const masked = getEffectiveConfigMasked();
    expect(masked.openai.apiKey).not.toBe("sk-super-secret-key-value");
    expect(String(masked.openai.apiKey)).toContain("...");
  });

  it("RESTART_REQUIRED_KEYS includes PORT and HUB keys", () => {
    expect(RESTART_REQUIRED_KEYS.has("PORT")).toBe(true);
    expect(RESTART_REQUIRED_KEYS.has("HUB_ADMIN_KEY")).toBe(true);
  });

  it("HOT_RELOAD_KEYS includes LLM and Telegram keys", () => {
    expect(HOT_RELOAD_KEYS.has("OPENAI_API_KEY")).toBe(true);
    expect(HOT_RELOAD_KEYS.has("TELEGRAM_BOT_TOKEN")).toBe(true);
  });
});
