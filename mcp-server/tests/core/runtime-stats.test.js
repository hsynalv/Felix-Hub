import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/core/plugins.js", () => ({
  getPlugins: vi.fn(() => [{ name: "github" }, { name: "notion" }]),
  getFailedPlugins: vi.fn(() => [{ name: "broken-plugin", error: "load failed" }]),
}));

vi.mock("../../src/core/tool-registry.js", () => ({
  listTools: vi.fn(() => [
    { name: "github_list_repos", plugin: "github", tags: ["read_only"] },
    { name: "notion_search", plugin: "notion", tags: ["read_only", "NETWORK"] },
  ]),
}));

vi.mock("../../src/core/jobs.js", () => ({
  getJobStats: vi.fn(async () => ({
    total: 3,
    queued: 1,
    running: 0,
    completed: 2,
    failed: 0,
    cancelled: 0,
  })),
}));

import { getPlugins, getFailedPlugins } from "../../src/core/plugins.js";
import { listTools } from "../../src/core/tool-registry.js";
import { getJobStats } from "../../src/core/jobs.js";
import {
  getPluginStats,
  getToolStats,
  getHealthStatus,
  getSystemSnapshot,
} from "../../src/core/observability/runtime.stats.js";

describe("runtime.stats - production wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports plugin stats from getPlugins/getFailedPlugins", () => {
    const stats = getPluginStats();

    expect(getPlugins).toHaveBeenCalled();
    expect(getFailedPlugins).toHaveBeenCalled();
    expect(stats).toEqual({
      total: 3,
      enabled: 2,
      loaded: 2,
      healthy: 2,
      failed: 1,
      pluginNames: ["github", "notion"],
    });
  });

  it("reports tool stats from listTools", () => {
    const stats = getToolStats();

    expect(listTools).toHaveBeenCalled();
    expect(stats.total).toBe(2);
    expect(stats.byPlugin).toEqual({ github: 1, notion: 1 });
    expect(stats.categories).toEqual(expect.arrayContaining(["read_only", "NETWORK"]));
  });

  it("marks health degraded when plugins failed to load", () => {
    const health = getHealthStatus();

    expect(health.status).toBe("degraded");
    expect(health.checks.registry).toBe(true);
    expect(health.checks.plugins).toBe(false);
  });

  it("includes legacy job stats in system snapshot", async () => {
    const snapshot = await getSystemSnapshot();

    expect(getJobStats).toHaveBeenCalled();
    expect(snapshot.jobs.completed).toBe(2);
    expect(snapshot.tools.total).toBe(2);
  });
});
