/**
 * Plugin Metrics
 *
 * Metrics collection for plugin system.
 * Uses canonical plugins.js loader state (not deprecated registry/index.js).
 */

import { getPlugins, getFailedPlugins } from "../plugins.js";
import { Metrics, getMetricsRegistry } from "./metrics.js";

/**
 * Record plugin call
 * @param {string} pluginName
 * @param {string} action
 * @param {string} status - "success" | "error"
 * @param {number} [duration]
 */
export function recordPluginCall(pluginName, action, status, duration) {
  const registry = getMetricsRegistry();

  registry.increment(Metrics.PLUGIN_CALLS_TOTAL, 1, {
    plugin: pluginName,
    action,
    status,
  });

  if (duration !== undefined) {
    registry.observe(Metrics.PLUGIN_EXECUTION_DURATION_MS, duration, {
      plugin: pluginName,
      action,
    });
  }

  if (status === "error") {
    registry.increment(Metrics.ERRORS_TOTAL, 1, {
      type: "plugin",
      plugin: pluginName,
      action,
    });
  }
}

/**
 * Update plugin gauge
 * @param {string} pluginName
 * @param {boolean} enabled
 */
export function updatePluginGauge(pluginName, enabled) {
  void pluginName;
  void enabled;
}

function getPluginStatus() {
  const plugins = getPlugins();
  const failed = getFailedPlugins();
  return {
    enabled: plugins.length,
    total: plugins.length + failed.length,
    healthy: plugins.length,
    failed: failed.length,
    loaded: plugins.length,
  };
}

/**
 * Get plugin metrics snapshot
 * @returns {Object}
 */
export function getPluginMetrics() {
  const status = getPluginStatus();

  return {
    plugins_enabled: status.enabled,
    plugins_total: status.total,
    plugins_healthy: status.healthy,
    plugins_failed: status.failed,
    plugins_loaded: status.loaded,
  };
}

/**
 * Initialize plugin metrics gauges
 */
export function initializePluginMetrics() {
  const metrics = getMetricsRegistry();
  metrics.set(Metrics.PLUGINS_ENABLED, 0);
  metrics.set(Metrics.TOOLS_TOTAL, 0);
}

/**
 * Sync plugin metrics with registry
 */
export function syncPluginMetrics() {
  const metrics = getMetricsRegistry();
  const status = getPluginStatus();
  metrics.set(Metrics.PLUGINS_ENABLED, status.enabled);
}
