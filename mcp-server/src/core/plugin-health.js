/**
 * Standard plugin health route helper.
 */

import { requireScope } from "./auth.js";

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
 * Mount GET /health on a plugin router.
 * @param {import("express").Router} router
 * @param {{ name: string, version: string, scope?: string }} options
 */
export function mountPluginHealth(router, { name, version, scope = "read" }) {
  router.get("/health", requireScope(scope), pluginHealthHandler(name, version));
}
