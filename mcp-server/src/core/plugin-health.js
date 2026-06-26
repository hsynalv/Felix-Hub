/**
 * Standard plugin health route helper.
 */

import { requireScope } from "./auth.js";
import { PLUGIN_ENV_CATALOG, getPluginEnvCompleteness } from "./plugin-env-catalog.js";
import { recordPluginHealth } from "./plugin-state.service.js";
import { getPlugins } from "./plugins.js";
import { writeSettingsAudit } from "./settings/settings.service.js";

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
 * Resolve GET /health path from plugin manifest endpoints.
 * @param {string} pluginName
 */
export function getPluginHealthPath(pluginName) {
  const plugin = getPlugins().find((p) => p.name === pluginName);
  if (!plugin) return null;
  const ep = (plugin.endpoints || []).find(
    (e) =>
      e.method === "GET" &&
      /\/health$/i.test(e.path) &&
      !/\/health\//i.test(e.path)
  );
  return ep?.path ?? null;
}

/**
 * HTTP probe against the plugin's declared health route (in-process server).
 * @param {string} pluginName
 */
export async function probePluginHealth(pluginName) {
  const path = getPluginHealthPath(pluginName);
  if (!path) {
    return { ok: true, skipped: true, message: "No health endpoint — env check only" };
  }

  const port = Number(process.env.PORT) || 8787;
  const token =
    process.env.HUB_ADMIN_KEY || process.env.HUB_READ_KEY || process.env.HUB_WRITE_KEY;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => ({}));
    const healthy =
      res.ok &&
      data.ok !== false &&
      data.status !== "unhealthy" &&
      data.status !== "degraded";
    if (healthy) {
      return {
        ok: true,
        message: typeof data.message === "string" ? data.message : "Health check passed",
        healthPath: path,
        health: data,
      };
    }
    return {
      ok: false,
      code: "health_failed",
      message:
        (typeof data.error === "object" && data.error?.message) ||
        (typeof data.message === "string" && data.message) ||
        `Health endpoint returned ${res.status}`,
      healthPath: path,
      health: data,
    };
  } catch (err) {
    return {
      ok: false,
      code: "health_unreachable",
      message: err instanceof Error ? err.message : "Health probe failed",
      healthPath: path,
    };
  }
}

/**
 * Run connection test for a plugin (env completeness + optional health probe).
 * @param {string} pluginName
 * @param {{ actor?: string }} [options]
 */
export async function runPluginConnectionTest(pluginName, { actor = null } = {}) {
  const completeness = getPluginEnvCompleteness(pluginName);

  if (!completeness.complete) {
    await recordPluginHealth(pluginName, { ok: false, envComplete: false });
    await writeSettingsAudit({
      action: "test",
      keyName: pluginName,
      pluginName,
      actor,
    });
    return {
      ok: false,
      code: "missing_env",
      missing: completeness.missing,
      message: `Missing required env: ${completeness.missing.join(", ")}`,
    };
  }

  const probe = await probePluginHealth(pluginName);
  const envOnly =
    !PLUGIN_ENV_CATALOG[pluginName] && probe.skipped;

  if (probe.skipped) {
    await recordPluginHealth(pluginName, { ok: true, envComplete: true });
    await writeSettingsAudit({
      action: "test",
      keyName: pluginName,
      pluginName,
      actor,
    });
    return {
      ok: true,
      skipped: true,
      message: envOnly
        ? "No required configuration — plugin ready"
        : probe.message,
    };
  }

  await recordPluginHealth(pluginName, { ok: probe.ok, envComplete: true });
  await writeSettingsAudit({
    action: "test",
    keyName: pluginName,
    pluginName,
    actor,
  });

  if (!probe.ok) {
    return {
      ok: false,
      code: probe.code || "health_failed",
      message: probe.message,
      healthPath: probe.healthPath,
    };
  }

  return {
    ok: true,
    message:
      PLUGIN_ENV_CATALOG[pluginName] && probe.message
        ? probe.message
        : "Connection test passed",
    healthPath: probe.healthPath,
  };
}

/**
 * Mount GET /health on a plugin router.
 * @param {import("express").Router} router
 * @param {{ name: string, version: string, scope?: string }} options
 */
export function mountPluginHealth(router, { name, version, scope = "read" }) {
  router.get("/health", requireScope(scope), pluginHealthHandler(name, version));
}
