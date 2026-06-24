/**
 * Unified strict-mode flags for plugin loading and tool registration.
 *
 * Canonical env vars:
 *   STRICT_PLUGIN_LOADING — fail startup if any plugin fails to load
 *   STRICT_PLUGIN_META      — missing plugin.meta.json is an error
 *   STRICT_TOOL_SCHEMA      — write/destructive tools require explanation in inputSchema
 *
 * Deprecated alias: PLUGIN_STRICT_MODE → STRICT_PLUGIN_LOADING
 */

function envTrue(name) {
  return process.env[name] === "true";
}

export function isStrictPluginLoading() {
  if (envTrue("STRICT_PLUGIN_LOADING")) return true;
  if (envTrue("PLUGIN_STRICT_MODE")) {
    console.warn(
      "[plugins] PLUGIN_STRICT_MODE is deprecated — use STRICT_PLUGIN_LOADING=true"
    );
    return true;
  }
  return false;
}

export function isStrictPluginMeta() {
  return envTrue("STRICT_PLUGIN_META");
}

export function isStrictToolSchema() {
  return envTrue("STRICT_TOOL_SCHEMA");
}
