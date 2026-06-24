/**
 * Plugin Loader Tests
 *
 * Uses a temporary plugins directory (PLUGINS_TEST_DIR) with real on-disk fixtures.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("../src/core/config.js", () => ({
  config: {
    plugins: {
      enableN8n: true,
      enableN8nCredentials: true,
      enableN8nWorkflows: true,
      strictLoading: false,
    },
  },
}));

vi.mock("../src/core/tool-registry.js", () => ({
  registerTool: vi.fn(),
}));

function writePlugin(dir, name, body) {
  const pluginDir = join(dir, name);
  mkdirSync(pluginDir, { recursive: true });
  writeFileSync(
    join(pluginDir, "plugin.meta.json"),
    JSON.stringify(
      {
        name,
        version: "1.0.0",
        status: "experimental",
        owner: "test",
        description: `${name} test fixture`,
      },
      null,
      2
    )
  );
  writeFileSync(join(pluginDir, "index.js"), body);
}

describe("Plugin Loader", () => {
  let app;
  let tempDir;
  let loadPlugins;
  let getPlugins;
  let getFailedPlugins;

  beforeEach(async () => {
    vi.resetModules();
    tempDir = mkdtempSync(join(tmpdir(), "plugins-test-"));
    process.env.PLUGINS_TEST_DIR = tempDir;
    app = express();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const plugins = await import("../src/core/plugins.js");
    loadPlugins = plugins.loadPlugins;
    getPlugins = plugins.getPlugins;
    getFailedPlugins = plugins.getFailedPlugins;
  });

  afterEach(() => {
    delete process.env.PLUGINS_TEST_DIR;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
    vi.restoreAllMocks();
  });

  it("should load a valid plugin", async () => {
    writePlugin(
      tempDir,
      "test-plugin",
      `export const name = "test-plugin";
export const version = "1.0.0";
export function register(app) {}`
    );

    await loadPlugins(app);

    const plugins = getPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe("test-plugin");
    expect(plugins[0].version).toBe("1.0.0");
  });

  it("should track plugin failures when import fails", async () => {
    writePlugin(
      tempDir,
      "broken-plugin",
      `throw new Error("Import failed");`
    );

    await loadPlugins(app);

    const failed = getFailedPlugins();
    expect(failed).toHaveLength(1);
    expect(failed[0].name).toBe("broken-plugin");
    expect(failed[0].reason).toContain("failed to load");
  });

  it("should skip plugin when index.js is missing", async () => {
    mkdirSync(join(tempDir, "empty-plugin"), { recursive: true });

    await loadPlugins(app);

    expect(getPlugins()).toHaveLength(0);
    const failed = getFailedPlugins();
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toContain("missing index.js");
  });

  it("should skip plugin when register function is missing", async () => {
    writePlugin(
      tempDir,
      "no-register-plugin",
      `export const name = "no-register-plugin";
export const version = "1.0.0";`
    );

    await loadPlugins(app);

    expect(getPlugins()).toHaveLength(0);
    const failed = getFailedPlugins();
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toContain("has no register(app) export");
  });

  it("should handle async plugin registration", async () => {
    writePlugin(
      tempDir,
      "async-plugin",
      `export const name = "async-plugin";
export const version = "1.0.0";
export async function register(app) {}`
    );

    await loadPlugins(app);

    expect(getPlugins()).toHaveLength(1);
    expect(getPlugins()[0].name).toBe("async-plugin");
  });

  it("should track failed plugins when register throws", async () => {
    writePlugin(
      tempDir,
      "error-plugin",
      `export const name = "error-plugin";
export const version = "1.0.0";
export async function register() { throw new Error("Registration failed"); }`
    );

    await loadPlugins(app);

    expect(getPlugins()).toHaveLength(0);
    const failed = getFailedPlugins();
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toContain("register() failed");
  });

  it("should clear loaded array on reload (duplicate protection)", async () => {
    writePlugin(
      tempDir,
      "test-plugin",
      `export const name = "test-plugin";
export const version = "1.0.0";
export function register(app) {}`
    );

    await loadPlugins(app);
    expect(getPlugins()).toHaveLength(1);

    await loadPlugins(app);
    expect(getPlugins()).toHaveLength(1);
  });

  it("should throw in STRICT mode when plugin fails", async () => {
    const prev = process.env.STRICT_PLUGIN_LOADING;
    process.env.STRICT_PLUGIN_LOADING = "true";
    mkdirSync(join(tempDir, "broken-plugin"), { recursive: true });

    await expect(loadPlugins(app)).rejects.toThrow("STRICT mode");

    if (prev === undefined) delete process.env.STRICT_PLUGIN_LOADING;
    else process.env.STRICT_PLUGIN_LOADING = prev;
  });

  it("should skip disabled n8n plugins", async () => {
    const { config } = await import("../src/core/config.js");
    config.plugins.enableN8n = false;

    writePlugin(
      tempDir,
      "other-plugin",
      `export const name = "other-plugin";
export const version = "1.0.0";
export function register(app) {}`
    );
    mkdirSync(join(tempDir, "n8n"), { recursive: true });
    writeFileSync(join(tempDir, "n8n", "index.js"), "export function register() {}");

    await loadPlugins(app);

    const plugins = getPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe("other-plugin");

    config.plugins.enableN8n = true;
  });
});
