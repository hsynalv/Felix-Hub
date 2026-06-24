#!/usr/bin/env node
/**
 * Sync security.riskLevel, security.capabilities, security.requiresApproval
 * on all plugin.meta.json files from scope + plugin name heuristics.
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginsDir = join(__dirname, "../src/plugins");

const DESTRUCTIVE_PLUGINS = new Set(["shell", "docker"]);
const NETWORK_PLUGINS = new Set([
  "http", "github", "notion", "slack", "n8n", "n8n-credentials", "n8n-workflows",
  "llm-router", "image-gen", "video-gen", "marketplace", "notifications",
  "openapi", "local-sidecar",
]);
const SHELL_PLUGINS = new Set(["shell"]);
const GIT_PLUGINS = new Set(["git", "github", "github-pattern-analyzer", "repo-intelligence"]);
const LOCAL_FS_PLUGINS = new Set([
  "file-storage", "file-watcher", "workspace", "brain", "local-sidecar", "rag",
]);

function inferSecurity(name, security = {}) {
  const scope = security.scope || "read";
  const capabilities = new Set();

  if (scope === "read" || scope === "write" || scope === "admin") {
    capabilities.add(scope === "admin" ? "write" : scope);
  }
  if (NETWORK_PLUGINS.has(name)) capabilities.add("network");
  if (GIT_PLUGINS.has(name)) capabilities.add("git");
  if (LOCAL_FS_PLUGINS.has(name)) capabilities.add("read");
  if (SHELL_PLUGINS.has(name)) capabilities.add("shell");

  let riskLevel = "low";
  if (DESTRUCTIVE_PLUGINS.has(name)) {
    riskLevel = "destructive";
    capabilities.add("destructive");
  } else if (scope === "admin" || SHELL_PLUGINS.has(name)) {
    riskLevel = "high";
  } else if (scope === "write") {
    riskLevel = "medium";
  }

  const requiresApproval = [];
  if (security.requiresApproval === true || DESTRUCTIVE_PLUGINS.has(name)) {
    requiresApproval.push("write", "destructive");
  } else if (scope === "write") {
    requiresApproval.push("write");
  }

  return {
    ...security,
    riskLevel,
    capabilities: [...capabilities],
    requiresApproval,
  };
}

let updated = 0;
for (const dir of readdirSync(pluginsDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const metaPath = join(pluginsDir, dir.name, "plugin.meta.json");
  try {
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    meta.security = inferSecurity(dir.name, meta.security || {});
    writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
    updated++;
  } catch {
    console.warn(`skip ${dir.name}: no plugin.meta.json`);
  }
}

console.log(`Updated security manifest on ${updated} plugins`);
