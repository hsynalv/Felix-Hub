import { readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { config } from "./config.js";
import { registerTool, clearTools, unregisterToolsForPlugin } from "./tool-registry.js";
import { validatePluginMeta, getQualitySummary } from "./plugin-meta.js";
import { isStrictPluginLoading } from "./plugin-strict.js";
import { isPluginEnabled, setPluginEnabled as persistPluginEnabled } from "./plugin-state.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolvePluginsDir() {
  if (process.env.PLUGINS_TEST_DIR) {
    return process.env.PLUGINS_TEST_DIR;
  }
  return join(__dirname, "../plugins");
}

const loaded = [];
const failedPlugins = [];

/** @type {Map<string, object[]>} Cached tool defs for runtime re-enable */
const pluginToolCache = new Map();

function registerPluginTools(plugin, dir) {
  const pluginName = plugin.name || dir;
  const toolDefs = Array.isArray(plugin.tools) ? plugin.tools : [];
  pluginToolCache.set(pluginName, toolDefs);

  let registered = 0;
  let failed = 0;
  for (const tool of toolDefs) {
    try {
      registerTool({
        ...tool,
        plugin: pluginName,
      });
      registered++;
    } catch (err) {
      console.warn(`[plugins] failed to register tool "${tool.name}" from "${dir}": ${err.message}`);
      failed++;
    }
  }
  return { registered, failed };
}

/**
 * Discover and load plugins from src/plugins/<name>/index.js.
 *
 * Each plugin must export:
 *   name      string   — plugin identifier
 *   version   string   — semver
 *   register  function — register(app) mounts routes
 *
 * Optional manifest fields (used by GET /plugins and GET /plugins/:name/manifest):
 *   description  string
 *   capabilities string[]  e.g. ["read", "write"]
 *   endpoints    { path, method, description, scope? }[]
 *   requires     string[]  env var names that must be set
 *   examples     string[]  curl examples
 *   tools        { name, description, inputSchema?, handler }[]  — MCP tools
 */
export async function loadPlugins(app) {
  // Reset arrays and tool registry to avoid duplication on reload
  loaded.length = 0;
  failedPlugins.length = 0;
  clearTools();
  pluginToolCache.clear();
  const dirs = readdirSync(resolvePluginsDir(), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  // Statistics for startup validation report
  let stats = {
    pluginsLoaded: 0,
    pluginsFailed: 0,
    toolsRegistered: 0,
    toolsFailed: 0,
  };

  for (const dir of dirs) {
    // Check if this plugin should be disabled
    if (dir === "n8n" && !config.plugins.enableN8n) {
      console.log(`[plugins] "${dir}" disabled by ENABLE_N8N_PLUGIN=false`);
      continue;
    }
    if (dir === "n8n-credentials" && !config.plugins.enableN8nCredentials) {
      console.log(`[plugins] "${dir}" disabled by ENABLE_N8N_CREDENTIALS=false`);
      continue;
    }
    if (dir === "n8n-workflows" && !config.plugins.enableN8nWorkflows) {
      console.log(`[plugins] "${dir}" disabled by ENABLE_N8N_WORKFLOWS=false`);
      continue;
    }

    // Validate plugin folder structure
    const pluginIndexPath = join(resolvePluginsDir(), dir, "index.js");
    if (!existsSync(pluginIndexPath)) {
      const reason = "missing index.js";
      console.warn(`[plugins] "${dir}" ${reason} — skipped`);
      failedPlugins.push({ name: dir, reason });
      stats.pluginsFailed++;
      continue;
    }

    const pluginDir = join(resolvePluginsDir(), dir);
    const url = pathToFileURL(pluginIndexPath).href;

    // Validate plugin metadata
    const metaValidation = validatePluginMeta(pluginDir, dir);
    if (!metaValidation.valid) {
      const reason = `invalid metadata: ${metaValidation.errors.join("; ")}`;
      console.warn(`[plugins] "${dir}" ${reason}`);
      failedPlugins.push({ name: dir, reason, errors: metaValidation.errors });
      stats.pluginsFailed++;
      continue;
    }

    // Log warnings if any
    for (const warning of metaValidation.warnings) {
      console.warn(`[plugins] "${dir}" warning: ${warning}`);
    }

    const pluginMeta = metaValidation.meta;
    let plugin;
    try {
      plugin = await import(url);
    } catch (err) {
      const reason = `failed to load: ${err.message}`;
      console.warn(`[plugins] "${dir}" ${reason}`);
      failedPlugins.push({ name: dir, reason });
      stats.pluginsFailed++;
      continue;
    }

    if (typeof plugin.register !== "function") {
      const reason = "has no register(app) export";
      console.warn(`[plugins] "${dir}" ${reason} — skipped`);
      failedPlugins.push({ name: dir, reason });
      stats.pluginsFailed++;
      continue;
    }

    // Support async plugin initialization
    try {
      await plugin.register(app);
    } catch (err) {
      const reason = `register() failed: ${err.message}`;
      console.error(`[plugins] "${dir}" ${reason}`);
      failedPlugins.push({ name: dir, reason });
      stats.pluginsFailed++;
      continue;
    }

    const pluginName = plugin.name ?? plugin.metadata?.name ?? dir;
    const enabled = await isPluginEnabled(pluginName);

    // Register MCP tools from plugin (skip when disabled)
    let pluginToolsRegistered = 0;
    let pluginToolsFailed = 0;
    if (enabled) {
      const toolResult = registerPluginTools(plugin, dir);
      pluginToolsRegistered = toolResult.registered;
      pluginToolsFailed = toolResult.failed;
      stats.toolsRegistered += pluginToolsRegistered;
      stats.toolsFailed += pluginToolsFailed;
    } else {
      pluginToolCache.set(pluginName, Array.isArray(plugin.tools) ? plugin.tools : []);
      console.log(`[plugins] "${pluginName}" disabled — tools not registered`);
    }

    // Prefer flat exports; fall back to plugin.metadata for standardized plugins
    // that use createMetadata() and don't duplicate flat-level exports.
    const pm = plugin.metadata || {};

    const manifest = {
      name:         plugin.name        ?? pm.name        ?? dir,
      version:      plugin.version     ?? pm.version     ?? "0.0.0",
      description:  plugin.description ?? pm.description ?? "",
      capabilities: plugin.capabilities ?? pm.capabilities ?? [],
      endpoints:    plugin.endpoints    ?? pm.endpoints   ?? [],
      tools:        plugin.tools?.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema || { type: "object" },
      })) ?? [],
      requires:     plugin.requires     ?? pm.requires    ?? [],
      examples:     plugin.examples     ?? pm.examples    ?? [],
      status:       pluginMeta.status,
      owner:        pluginMeta.owner,
      testLevel:    pluginMeta.testLevel,
      requiresAuth: pluginMeta.requiresAuth,
      supportsJobs: pluginMeta.supportsJobs,
      resilience:   pluginMeta.resilience,
      security:     pluginMeta.security,
      documentation: pluginMeta.documentation,
      enabled,
    };

    loaded.push(manifest);
    stats.pluginsLoaded++;
    console.log(`[plugins] loaded ${manifest.name}@${manifest.version} (${pluginToolsRegistered} tools${pluginToolsFailed > 0 ? `, ${pluginToolsFailed} failed` : ""}${!enabled ? ", disabled" : ""})`);
  }

  // Print startup validation summary with diagnostics
  printStartupSummary();

  // Print quality summary
  const qualitySummary = getQualitySummary(loaded);
  printQualitySummary(qualitySummary);

  // STRICT mode: fail startup if any plugin failed
  if (isStrictPluginLoading() && failedPlugins.length > 0) {
    throw new Error(`STRICT mode: ${failedPlugins.length} plugin(s) failed to load. Check logs above.`);
  }
}

/**
 * Print clean startup diagnostics summary
 */
function printStartupSummary() {
  console.log("");

  // Loaded plugins
  console.log("Loaded Plugins:");
  if (loaded.length > 0) {
    for (const p of loaded) {
      console.log(`- ${p.name}`);
    }
  }

  // Failed plugins
  console.log("");
  if (failedPlugins.length > 0) {
    console.log("Failed Plugins:");
    for (const f of failedPlugins) {
      console.log(`- ${f.name}: ${f.reason}`);
    }
  } else {
    console.log("Failed Plugins: none");
  }

  console.log("");
}

/**
 * Print plugin quality summary
 */
function printQualitySummary(summary) {
  console.log("Plugin Quality Summary:");
  console.log(`  Total: ${summary.total}`);
  console.log(`  By Status: stable=${summary.byStatus.stable}, beta=${summary.byStatus.beta}, experimental=${summary.byStatus.experimental}`);
  console.log(`  By Test Level: none=${summary.byTestLevel.none}, unit=${summary.byTestLevel.unit}, integration=${summary.byTestLevel.integration}, e2e=${summary.byTestLevel.e2e}`);
  console.log(`  Features: auth=${summary.authRequired}, jobs=${summary.supportsJobs}, resilience=${summary.withResilience}`);
  
  if (summary.issues.length > 0) {
    console.log("  Issues:");
    for (const issue of summary.issues) {
      console.log(`    - [${issue.severity}] ${issue.plugin}: ${issue.message}`);
    }
  }
  
  console.log("");
}

/** Returns full manifest of all successfully loaded plugins. */
export function getPlugins() {
  return loaded;
}

/** Returns list of plugins that failed to load. */
export function getFailedPlugins() {
  return [...failedPlugins];
}

/**
 * Runtime enable/disable without full server restart.
 * @param {string} pluginName
 * @param {boolean} enabled
 * @param {{ actor?: string, envComplete?: boolean }} opts
 */
export async function togglePluginRuntime(pluginName, enabled, { actor = "api", envComplete = true } = {}) {
  const manifest = loaded.find((p) => p.name === pluginName);
  if (!manifest) {
    throw new Error(`Plugin "${pluginName}" is not loaded`);
  }

  await persistPluginEnabled(pluginName, enabled, { actor, envComplete });
  manifest.enabled = enabled;

  if (!enabled) {
    unregisterToolsForPlugin(pluginName);
    return manifest;
  }

  const cached = pluginToolCache.get(pluginName) || [];
  for (const tool of cached) {
    registerTool({ ...tool, plugin: pluginName });
  }
  return manifest;
}
