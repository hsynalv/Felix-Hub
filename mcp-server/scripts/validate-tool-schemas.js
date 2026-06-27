#!/usr/bin/env node
/**
 * Validate all plugin tool definitions under STRICT_TOOL_SCHEMA.
 * Uses the same path as registerTool: prepareToolForRegistration + validateTool + validateTags.
 */

import { readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import {
  prepareToolForRegistration,
  validateTool,
  validateTags,
} from "../src/core/tool-registry.js";

process.env.STRICT_TOOL_SCHEMA = "true";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = join(__dirname, "../src/plugins");

const dirs = readdirSync(PLUGINS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

let errors = 0;
let ok = 0;

for (const dir of dirs.sort()) {
  const indexPath = join(PLUGINS_DIR, dir, "index.js");
  if (!existsSync(indexPath)) continue;

  let mod;
  try {
    mod = await import(pathToFileURL(indexPath).href);
  } catch (err) {
    console.warn(`[SKIP] ${dir}: failed to load (${err.message})`);
    continue;
  }

  const toolDefs = Array.isArray(mod.tools) ? mod.tools : [];
  for (const t of toolDefs) {
    try {
      const tool = prepareToolForRegistration({ ...t, plugin: mod.name || dir });
      validateTool(tool);
      validateTags(tool.tags || []);
      ok++;
    } catch (err) {
      console.error(`[FAIL] ${dir}/${t.name}: ${err.message}`);
      errors++;
    }
  }
}

console.log(`\nvalidate:tools — ${ok} tools ok, ${errors} errors`);

process.exit(errors > 0 ? 1 : 0);
