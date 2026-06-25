/**
 * Unified strict-mode flags for plugin loading and tool registration.
 */

import { config } from "./config.js";

function envTrue(name) {
  return process.env[name] === "true";
}

export function isStrictPluginLoading() {
  if (envTrue("STRICT_PLUGIN_LOADING")) return true;
  if (config?.plugins?.strictLoading) return true;
  if (envTrue("PLUGIN_STRICT_MODE")) {
    console.warn(
      "[plugins] PLUGIN_STRICT_MODE is deprecated — use STRICT_PLUGIN_LOADING=true"
    );
    return true;
  }
  return false;
}

export function isStrictPluginMeta() {
  if (envTrue("STRICT_PLUGIN_META")) return true;
  return config?.plugins?.strictMeta === true;
}

export function isStrictToolSchema() {
  if (envTrue("STRICT_TOOL_SCHEMA")) return true;
  return config?.plugins?.strictToolSchema === true;
}
