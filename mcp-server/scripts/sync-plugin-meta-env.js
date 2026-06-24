#!/usr/bin/env node
/**
 * Merge PLUGIN_ENV_CATALOG entries into plugin.meta.json files.
 * Usage: node scripts/sync-plugin-meta-env.js [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { PLUGIN_ENV_CATALOG, normalizeEnvVarEntries } from "../src/core/plugin-env-catalog.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = join(__dirname, "../src/plugins");
const dryRun = process.argv.includes("--dry-run");

let updated = 0;

for (const [pluginName, catalogEntries] of Object.entries(PLUGIN_ENV_CATALOG)) {
  const metaPath = join(PLUGINS_DIR, pluginName, "plugin.meta.json");
  if (!existsSync(metaPath)) {
    console.warn(`[skip] missing meta: ${pluginName}`);
    continue;
  }

  const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
  const existing = normalizeEnvVarEntries(meta.envVars);
  const byName = new Map(existing.map((entry) => [entry.name, entry]));

  for (const entry of catalogEntries) {
    if (!byName.has(entry.name)) {
      byName.set(entry.name, entry);
    }
  }

  meta.envVars = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));

  const json = `${JSON.stringify(meta, null, 2)}\n`;
  if (dryRun) {
    console.log(`[dry-run] would update ${metaPath}`);
  } else {
    writeFileSync(metaPath, json);
    console.log(`[sync] ${metaPath}`);
    updated++;
  }
}

console.log(`\nsync-plugin-meta-env — ${updated} file(s) updated`);
