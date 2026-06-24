import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const PLUGINS_DIR = join(process.cwd(), "src/plugins");

describe("plugin health routes", () => {
  const pluginDirs = readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(PLUGINS_DIR, name, "index.js")));

  it("every plugin exposes a /health route", () => {
    const missing = [];

    for (const name of pluginDirs) {
      const source = readFileSync(join(PLUGINS_DIR, name, "index.js"), "utf-8");
      const hasHealth =
        source.includes('router.get("/health"') ||
        source.includes("mountPluginHealth(");
      if (!hasHealth) {
        missing.push(name);
      }
    }

    expect(missing, `missing health route: ${missing.join(", ")}`).toEqual([]);
  });
});
