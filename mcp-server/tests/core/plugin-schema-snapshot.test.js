/**
 * Plugin meta schema snapshot — breaking meta changes fail CI.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { validatePluginMeta } from "../../src/core/plugin-meta.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = join(__dirname, "../../src/plugins");
const SNAPSHOT_PATH = join(__dirname, "../fixtures/plugin-meta-snapshot.json");

function buildSnapshot() {
  const dirs = readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const plugins = [];
  for (const name of dirs) {
    if (!existsSync(join(PLUGINS_DIR, name, "index.js"))) continue;
    const result = validatePluginMeta(join(PLUGINS_DIR, name), name);
    expect(result.valid, `${name}: ${result.errors.join("; ")}`).toBe(true);
    plugins.push({
      name,
      version: result.meta?.version || null,
      riskLevel: result.meta?.security?.riskLevel || null,
      dangerousCombinations: result.meta?.security?.dangerousCombinations || [],
    });
  }
  return { generatedAt: new Date().toISOString().slice(0, 10), count: plugins.length, plugins };
}

describe("plugin meta snapshot", () => {
  it("matches committed snapshot", () => {
    const current = buildSnapshot();
    const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));

    expect(current.count).toBe(snapshot.count);
    expect(current.plugins.map((p) => p.name)).toEqual(snapshot.plugins.map((p) => p.name));

    for (const expected of snapshot.plugins) {
      const actual = current.plugins.find((p) => p.name === expected.name);
      expect(actual, `missing plugin ${expected.name}`).toBeTruthy();
      expect(actual.riskLevel).toBe(expected.riskLevel);
      expect(actual.dangerousCombinations).toEqual(expected.dangerousCombinations);
    }
  });
});
