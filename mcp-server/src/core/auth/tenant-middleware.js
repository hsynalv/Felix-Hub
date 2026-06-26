/**
 * Load tenant settings overlay before request handlers run.
 */

import { loadTenantOverlay } from "./tenant-overlay.js";

export async function tenantOverlayMiddleware(req, res, next) {
  try {
    if (req.user?.namespace) {
      await loadTenantOverlay(req.user.namespace);
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * @param {import('express').Request} req
 */
export function resolveSettingsNamespace(req) {
  if (req.user?.namespace) return req.user.namespace;
  return req.query.namespace || "default";
}

/**
 * @param {import('express').Request} req
 */
export function resolveChatNamespace(req) {
  if (req.user?.namespace) return req.user.namespace;
  return "default";
}
