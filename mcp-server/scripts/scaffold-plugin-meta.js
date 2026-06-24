#!/usr/bin/env node
/**
 * Scaffold plugin.meta.json for plugins missing the file.
 * Usage: node scripts/scaffold-plugin-meta.js [--dry-run] [--force]
 */

import { readdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = join(__dirname, "../src/plugins");

const CORE_20 = new Set([
  "llm-router", "notion", "github", "database", "shell", "rag", "brain",
  "github-pattern-analyzer", "n8n", "repo-intelligence", "project-orchestrator",
  "http", "secrets", "workspace", "git", "prompt-registry", "observability",
  "tech-detector", "n8n-workflows", "code-review",
]);

const STABLE_CORE = new Set(["shell", "notion", "github", "llm-router"]);

const EXTENSION_BETA = new Set([
  "notifications", "policy", "openapi", "projects", "file-storage",
]);

const WRITE_PLUGINS = new Set([
  "shell", "git", "workspace", "database", "brain", "secrets", "http",
  "n8n", "n8n-workflows", "project-orchestrator", "notifications",
  "slack", "email", "image-gen", "video-gen", "docker", "file-storage",
]);

function parsePluginExports(indexPath) {
  const src = readFileSync(indexPath, "utf-8");
  const version = src.match(/export const version\s*=\s*["']([^"']+)["']/)?.[1] || "1.0.0";
  const description =
    src.match(/export const description\s*=\s*["']([^"']+)["']/)?.[1] ||
    src.match(/export const description\s*=\s*`([^`]+)`/)?.[1]?.slice(0, 200) ||
    "";
  const capabilities = src.match(/export const capabilities\s*=\s*\[([^\]]+)\]/)?.[1] || "";
  const hasWrite = capabilities.includes("write");
  return { version, description: description.replace(/\s+/g, " ").trim(), hasWrite };
}

function inferStatus(name) {
  if (STABLE_CORE.has(name)) return "stable";
  if (CORE_20.has(name)) return "beta";
  if (EXTENSION_BETA.has(name)) return "beta";
  return "experimental";
}

function inferScope(name, hasWrite) {
  if (WRITE_PLUGINS.has(name) || hasWrite) return "write";
  return "read";
}

function buildMeta(name, info) {
  const status = inferStatus(name);
  const scope = inferScope(name, info.hasWrite);
  return {
    name,
    version: info.version,
    status,
    owner: "core-team",
    description: info.description || `${name} plugin`,
    requiresAuth: true,
    supportsJobs: ["n8n-workflows", "project-orchestrator", "rag"].includes(name),
    supportsStreaming: ["llm-router", "shell"].includes(name),
    testLevel: status === "stable" ? "integration" : "unit",
    resilience: {
      retry: status === "stable",
      timeout: 30000,
      circuitBreaker: false,
    },
    security: {
      scope,
      dangerousCombinations: scope === "write" ? ["write"] : [],
      requiresApproval: ["shell", "database", "project-orchestrator"].includes(name),
    },
    performance: {
      avgResponseTimeMs: 500,
      maxConcurrent: 10,
    },
    documentation: {
      readme: true,
      examples: status === "stable",
      apiReference: CORE_20.has(name),
    },
    dependencies: [],
    envVars: [],
  };
}

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

const dirs = readdirSync(PLUGINS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

let created = 0;
let skipped = 0;

for (const name of dirs.sort()) {
  const pluginDir = join(PLUGINS_DIR, name);
  const metaPath = join(pluginDir, "plugin.meta.json");
  const indexPath = join(pluginDir, "index.js");

  if (!existsSync(indexPath)) continue;
  if (existsSync(metaPath) && !force) {
    skipped++;
    continue;
  }

  const info = parsePluginExports(indexPath);
  const meta = buildMeta(name, info);
  const json = JSON.stringify(meta, null, 2) + "\n";

  if (dryRun) {
    console.log(`[dry-run] would write ${metaPath}`);
  } else {
    writeFileSync(metaPath, json);
    console.log(`[scaffold] ${metaPath}`);
    created++;
  }
}

console.log(`Done: ${created} created, ${skipped} skipped (existing)`);
