/**
 * Internal plugin marketplace — catalog, enable/disable, wizard, connection test.
 */

import { requireScope } from "../auth.js";
import { getPlugins, togglePluginRuntime } from "../plugins.js";
import { getPluginState, recordPluginHealth } from "../plugin-state.service.js";
import { listEnvCatalogEnriched, getPluginEnvCompleteness } from "../plugin-env-catalog.js";
import { runPluginConnectionTest } from "../plugin-health.js";
import { validatePluginMeta } from "../plugin-meta.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGINS_ROOT = join(__dirname, "../../plugins");

async function buildCatalogEntry(plugin) {
  const state = await getPluginState(plugin.name);
  const env = getPluginEnvCompleteness(plugin.name);
  let meta = {};
  try {
    const validation = validatePluginMeta(join(PLUGINS_ROOT, plugin.name), plugin.name);
    meta = validation.meta || {};
  } catch {
    /* ignore */
  }

  return {
    ...plugin,
    enabled: state.enabled !== false && plugin.enabled !== false,
    state: {
      enabled: state.enabled !== false,
      lastHealth: state.lastHealth,
      lastVerifiedAt: state.lastVerifiedAt,
      envComplete: env.complete,
    },
    maturity: meta.status || plugin.status || "beta",
    riskLevel: meta.security?.riskLevel || null,
    envVars: meta.envVars || [],
    missingEnv: env.missing,
  };
}

export function registerInternalMarketplaceRoutes(app) {
  app.get("/marketplace/catalog", requireScope("read"), async (_req, res) => {
    try {
      const plugins = getPlugins();
      const catalog = await Promise.all(plugins.map(buildCatalogEntry));
      res.json({ ok: true, data: { plugins: catalog, count: catalog.length } });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "catalog_failed", message: err.message } });
    }
  });

  app.get("/marketplace/plugins/:name/wizard", requireScope("read"), async (req, res) => {
    try {
      const plugin = getPlugins().find((p) => p.name === req.params.name);
      if (!plugin) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Plugin not found" } });
      }
      const enriched = listEnvCatalogEnriched(getPlugins());
      const envGroup = enriched.groups.find((g) => g.plugin === req.params.name);
      const env = getPluginEnvCompleteness(req.params.name);
      const state = await getPluginState(req.params.name);

      res.json({
        ok: true,
        data: {
          plugin: plugin.name,
          description: plugin.description,
          maturity: plugin.status || "beta",
          security: plugin.security || {},
          steps: [
            { id: "overview", title: "Overview", toolCount: plugin.tools?.length || 0 },
            { id: "permissions", title: "Permissions", capabilities: plugin.capabilities || [] },
            { id: "configuration", title: "Configuration", envGroup: envGroup || null, missingEnv: env.missing },
            { id: "test", title: "Test connection" },
            { id: "enable", title: "Enable", enabled: state.enabled !== false },
          ],
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "wizard_failed", message: err.message } });
    }
  });

  app.post("/marketplace/plugins/:name/enable", requireScope("admin"), async (req, res) => {
    try {
      const pluginName = req.params.name;
      const env = getPluginEnvCompleteness(pluginName);
      if (!env.complete) {
        return res.status(400).json({
          ok: false,
          error: { code: "incomplete_env", message: "Required environment not configured", missing: env.missing },
        });
      }

      const test = await runPluginConnectionTest(pluginName);
      if (!test.ok && test.code === "missing_env") {
        return res.status(400).json({ ok: false, error: { code: "test_failed", ...test } });
      }

      const manifest = await togglePluginRuntime(pluginName, true, {
        actor: req.actor?.type || "admin",
        envComplete: true,
      });
      res.json({ ok: true, data: manifest });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "enable_failed", message: err.message } });
    }
  });

  app.post("/marketplace/plugins/:name/disable", requireScope("admin"), async (req, res) => {
    try {
      const manifest = await togglePluginRuntime(req.params.name, false, {
        actor: req.actor?.type || "admin",
      });
      res.json({ ok: true, data: manifest });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "disable_failed", message: err.message } });
    }
  });

  app.post("/marketplace/plugins/:name/test", requireScope("admin"), async (req, res) => {
    try {
      const result = await runPluginConnectionTest(req.params.name);
      res.json({ ok: result.ok, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "test_failed", message: err.message } });
    }
  });

  app.post("/settings/test/:plugin", requireScope("admin"), async (req, res) => {
    try {
      const result = await runPluginConnectionTest(req.params.plugin);
      res.json({ ok: result.ok, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "test_failed", message: err.message } });
    }
  });
}
