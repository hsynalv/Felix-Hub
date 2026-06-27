#!/usr/bin/env node
/**
 * V8 prompt importer CLI — scan archive → derived draft JSON.
 *
 * Usage:
 *   node scripts/prompt-importer.js --dry-run
 *   node scripts/prompt-importer.js --provider Kiro --out cache/prompt-intelligence/drafts
 */

import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { scanPromptArchive, writeDraftReport } from "../src/core/chat/prompt-importer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { dryRun: false, provider: null, source: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--provider") out.provider = argv[++i];
    else if (a === "--source") out.source = argv[++i];
    else if (a === "--out") out.out = argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const config = JSON.parse(await readFile(join(__dirname, "importer.providers.json"), "utf8"));
  const source =
    args.source ||
    process.env.PROMPT_ARCHIVE_PATH ||
    (config.defaultSource ? join(__dirname, "..", config.defaultSource) : null);
  if (!source) {
    console.error("[prompt-importer] --source or PROMPT_ARCHIVE_PATH required");
    process.exit(1);
  }
  const outDir = args.out || join(__dirname, "..", config.defaultOut);

  console.log(`[prompt-importer] source=${source} provider=${args.provider || "all"}`);

  const drafts = await scanPromptArchive(source, {
    providerFilter: args.provider || undefined,
    maxFiles: args.dryRun ? 5 : 50,
  });

  console.log(`[prompt-importer] drafts=${drafts.length}`);
  for (const d of drafts.slice(0, 10)) {
    console.log(`  - ${d.id} risk=${d.provenance.risk} segments=${d.segmentCount} disabled=${d.disabled}`);
  }

  if (!args.dryRun && drafts.length) {
    const report = await writeDraftReport(outDir, drafts);
    console.log(`[prompt-importer] wrote ${report}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
