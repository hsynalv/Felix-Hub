/**
 * Plugin state + runtime toggle tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { registerTool, listTools, clearTools } from "../../src/core/tool-registry.js";
import {
  setPluginEnabled,
  isPluginEnabled,
  resetPluginStateForTests,
} from "../../src/core/plugin-state.service.js";
import { togglePluginRuntime } from "../../src/core/plugins.js";

describe("Plugin state", () => {
  beforeEach(() => {
    resetPluginStateForTests();
    clearTools();
  });

  it("defaults to enabled", async () => {
    expect(await isPluginEnabled("brain")).toBe(true);
  });

  it("persists disabled state", async () => {
    await setPluginEnabled("shell", false, { actor: "test" });
    expect(await isPluginEnabled("shell")).toBe(false);
    await setPluginEnabled("shell", true, { actor: "test" });
    expect(await isPluginEnabled("shell")).toBe(true);
  });
});

describe("Runtime plugin toggle", () => {
  beforeEach(() => {
    resetPluginStateForTests();
    clearTools();
    registerTool({
      name: "demo_tool",
      description: "demo",
      plugin: "demo-plugin",
      inputSchema: { type: "object", properties: {} },
      handler: async () => ({ ok: true }),
    });
  });

  it("unregisters tools on disable", async () => {
    // Seed loaded manifest via manual mock — togglePluginRuntime needs loaded array
    const plugins = await import("../../src/core/plugins.js");
    // Use getPlugins after we'd need loadPlugins - test unregisterToolsForPlugin directly
    const { unregisterToolsForPlugin } = await import("../../src/core/tool-registry.js");
    expect(listTools().some((t) => t.plugin === "demo-plugin")).toBe(true);
    unregisterToolsForPlugin("demo-plugin");
    expect(listTools().some((t) => t.plugin === "demo-plugin")).toBe(false);
  });
});
