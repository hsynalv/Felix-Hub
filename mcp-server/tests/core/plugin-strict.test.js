import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isStrictPluginLoading,
  isStrictPluginMeta,
  isStrictToolSchema,
} from "../../src/core/plugin-strict.js";

describe("plugin-strict flags", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it("STRICT_PLUGIN_LOADING enables strict loading", () => {
    delete process.env.PLUGIN_STRICT_MODE;
    process.env.STRICT_PLUGIN_LOADING = "true";
    expect(isStrictPluginLoading()).toBe(true);
  });

  it("PLUGIN_STRICT_MODE is deprecated alias", () => {
    delete process.env.STRICT_PLUGIN_LOADING;
    process.env.PLUGIN_STRICT_MODE = "true";
    expect(isStrictPluginLoading()).toBe(true);
  });

  it("STRICT_PLUGIN_META flag", () => {
    process.env.STRICT_PLUGIN_META = "true";
    expect(isStrictPluginMeta()).toBe(true);
  });

  it("STRICT_TOOL_SCHEMA flag", () => {
    process.env.STRICT_TOOL_SCHEMA = "true";
    expect(isStrictToolSchema()).toBe(true);
  });
});
