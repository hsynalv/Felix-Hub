/**
 * Marketplace enable/disable round-trip
 */

import { describe, it, expect } from "vitest";
import { getPlugins } from "../../src/core/plugins.js";
import { getPluginState } from "../../src/core/plugin-state.service.js";
import { togglePluginRuntime } from "../../src/core/plugins.js";

describe("marketplace enable", () => {
  it("disable removes plugin from enabled runtime list", async () => {
    const plugin = getPlugins().find((p) => p.name === "observability");
    if (!plugin) return;

    await togglePluginRuntime("observability", false, { actor: "test" });
    const state = await getPluginState("observability");
    expect(state.enabled).toBe(false);

    const enabledNames = getPlugins()
      .filter((p) => p.enabled !== false)
      .map((p) => p.name);
    expect(enabledNames.includes("observability")).toBe(false);

    await togglePluginRuntime("observability", true, { actor: "test" });
  });
});
