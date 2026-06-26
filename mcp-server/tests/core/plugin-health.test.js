/**
 * Plugin health path resolution and connection test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getPluginHealthPath, probePluginHealth } from "../../src/core/plugin-health.js";

vi.mock("../../src/core/plugins.js", () => ({
  getPlugins: vi.fn(() => [
    {
      name: "github",
      endpoints: [
        { method: "GET", path: "/github/health", description: "Plugin health", scope: "read" },
        { method: "GET", path: "/github/repos", description: "List repos", scope: "read" },
      ],
    },
    {
      name: "workspace",
      endpoints: [{ method: "GET", path: "/workspace/health", description: "Plugin health", scope: "read" }],
    },
  ]),
}));

describe("getPluginHealthPath", () => {
  it("returns manifest health path for plugin", () => {
    expect(getPluginHealthPath("github")).toBe("/github/health");
    expect(getPluginHealthPath("workspace")).toBe("/workspace/health");
  });

  it("returns null when no health endpoint", () => {
    expect(getPluginHealthPath("unknown")).toBeNull();
  });
});

describe("probePluginHealth", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("skips when plugin has no health route", async () => {
    const result = await probePluginHealth("unknown");
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("probes declared health endpoint", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, status: "healthy" }),
    });

    const result = await probePluginHealth("github");
    expect(result.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/github/health"),
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });
});
