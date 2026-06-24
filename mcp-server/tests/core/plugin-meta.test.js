/**
 * plugin.meta.json validation tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { validatePluginMeta, getQualitySummary } from "../../src/core/plugin-meta.js";

const PLUGINS_ROOT = join(process.cwd(), "src/plugins");
const shellDir = join(PLUGINS_ROOT, "shell");

describe("plugin-meta", () => {
  const envBackup = { ...process.env };
  let tempDir;

  afterEach(() => {
    process.env = { ...envBackup };
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("validates shell plugin.meta.json", () => {
    const result = validatePluginMeta(shellDir, "shell");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.meta.name).toBe("shell");
    expect(result.meta.status).toBe("stable");
  });

  it("rejects invalid JSON in plugin.meta.json", () => {
    tempDir = join(tmpdir(), `meta-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, "plugin.meta.json"), "{ not json");
    const result = validatePluginMeta(tempDir, "broken");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid JSON"))).toBe(true);
  });

  it("rejects name mismatch with folder", () => {
    tempDir = join(tmpdir(), `meta-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(
      join(tempDir, "plugin.meta.json"),
      JSON.stringify({ name: "wrong-name", version: "1.0.0", status: "beta", owner: "test" })
    );
    const result = validatePluginMeta(tempDir, "folder-name");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Name mismatch"))).toBe(true);
  });

  it("STRICT_PLUGIN_META fails when meta file missing", () => {
    tempDir = join(tmpdir(), `meta-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    process.env.STRICT_PLUGIN_META = "true";
    const result = validatePluginMeta(tempDir, "no-meta");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Missing plugin.meta.json"))).toBe(true);
  });

  it("missing meta returns defaults when not strict", () => {
    tempDir = join(tmpdir(), `meta-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    delete process.env.STRICT_PLUGIN_META;
    const result = validatePluginMeta(tempDir, "no-meta");
    expect(result.valid).toBe(true);
    expect(result.meta.status).toBe("experimental");
    expect(result.warnings.some((w) => w.includes("Missing plugin.meta.json"))).toBe(true);
  });

  it("getQualitySummary aggregates plugin list", () => {
    const summary = getQualitySummary([
      { name: "a", status: "stable", testLevel: "unit", requiresAuth: true, resilience: { retry: true } },
      { name: "b", status: "beta", testLevel: "none", requiresAuth: false, resilience: { retry: false } },
    ]);
    expect(summary.total).toBe(2);
    expect(summary.byStatus.stable).toBe(1);
    expect(summary.authRequired).toBe(1);
  });
});
