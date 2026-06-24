/**
 * Standard plugin health route helper.
 */

import { requireScope } from "./auth.js";
import { PLUGIN_ENV_CATALOG, getPluginEnvCompleteness } from "./plugin-env-catalog.js";
import { recordPluginHealth } from "./plugin-state.service.js";

/**
 * @param {string} name
 * @param {string} version
 */
export function pluginHealthHandler(name, version) {
  return (_req, res) => {
    res.json({ ok: true, status: "healthy", plugin: name, version });
  };
}

/**
 * Run connection test for a plugin (env completeness + optional health).
 * @param {string} pluginName
 */
export async function runPluginConnectionTest(pluginName) {
  const completeness = getPluginEnvCompleteness(pluginName);

  if (!completeness.complete) {
    await recordPluginHealth(pluginName, { ok: false, envComplete: false });
    return {
      ok: false,
      code: "missing_env",
      missing: completeness.missing,
      message: `Missing required env: ${completeness.missing.join(", ")}`,
    };
  }

  if (!PLUGIN_ENV_CATALOG[pluginName]) {
    await recordPluginHealth(pluginName, { ok: true, envComplete: true });
    return { ok: true, message: "No required configuration — plugin ready" };
  }

  await recordPluginHealth(pluginName, { ok: true, envComplete: true });
  return { ok: true, message: "Required environment configured" };
}

/**
 * Mount GET /health on a plugin router.
 * @param {import("express").Router} router
 * @param {{ name: string, version: string, scope?: string }} options
 */
export function mountPluginHealth(router, { name, version, scope = "read" }) {
  router.get("/health", requireScope(scope), pluginHealthHandler(name, version));
}
