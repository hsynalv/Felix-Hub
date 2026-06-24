#!/usr/bin/env node
/**
 * Validate all plugin.meta.json files against core validator + JSON schema fields.
 * Exit 1 on any error.
 */

import { readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { validatePluginMeta } from "../src/core/plugin-meta.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = join(__dirname, "../src/plugins");

const dirs = readdirSync(PLUGINS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

let errors = 0;
let warnings = 0;
let ok = 0;

for (const name of dirs.sort()) {
  const pluginDir = join(PLUGINS_DIR, name);
  if (!existsSync(join(pluginDir, "index.js"))) continue;

  const result = validatePluginMeta(pluginDir, name);
  if (!result.valid) {
    console.error(`[FAIL] ${name}: ${result.errors.join("; ")}`);
    errors++;
    continue;
  }
  if (result.warnings.length) {
    for (const w of result.warnings) {
      console.warn(`[WARN] ${name}: ${w}`);
      warnings++;
    }
  }
  ok++;
}

console.log(`\nvalidate:plugins — ${ok} ok, ${errors} errors, ${warnings} warnings`);

if (errors > 0) process.exit(1);
if (warnings > 0 && process.env.STRICT_PLUGIN_META === "true") process.exit(1);
