import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  normalizeToolDefinition,
  prepareToolForRegistration,
  registerTool,
  getTool,
  unregisterToolsForPlugin,
} from "../../src/core/tool-registry.js";
import * as imageGen from "../../src/plugins/image-gen/index.js";
import * as videoGen from "../../src/plugins/video-gen/index.js";

describe("legacy parameters → registerTool", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    unregisterToolsForPlugin("image-gen");
    unregisterToolsForPlugin("video-gen");
    vi.restoreAllMocks();
  });

  it("normalizeToolDefinition maps parameters before inputSchema check", () => {
    const normalized = normalizeToolDefinition({
      name: "legacy_example",
      parameters: { type: "object", properties: { q: { type: "string" } } },
    });
    expect(normalized.inputSchema?.properties?.q).toBeDefined();
    expect(normalized.parameters).toBeUndefined();
  });

  it("prepareToolForRegistration fails without normalize when only parameters exist", () => {
    const raw = imageGen.tools.find((t) => t.name === "image_generate");
    expect(raw?.parameters).toBeDefined();
    expect(raw?.inputSchema).toBeUndefined();

    const prepared = prepareToolForRegistration({ ...raw, plugin: "image-gen" });
    expect(prepared.inputSchema).toBeDefined();
    expect(prepared.parameters).toBeUndefined();
  });

  it("registers all image-gen tools that export legacy parameters", () => {
    expect(imageGen.tools.length).toBe(4);
    for (const tool of imageGen.tools) {
      registerTool({ ...tool, plugin: "image-gen" });
    }
    for (const tool of imageGen.tools) {
      const registered = getTool(tool.name);
      expect(registered, tool.name).toBeDefined();
      expect(registered.inputSchema).toBeDefined();
    }
  });

  it("registers all video-gen tools that export legacy parameters", () => {
    expect(videoGen.tools.length).toBe(5);
    for (const tool of videoGen.tools) {
      registerTool({ ...tool, plugin: "video-gen" });
    }
    for (const tool of videoGen.tools) {
      expect(getTool(tool.name), tool.name).toBeDefined();
    }
  });
});
