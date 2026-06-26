/**
 * Tenant-scoped settings overlay cache per user namespace.
 */

import { listAllSettingsDecrypted } from "../settings/settings.service.js";
import { applyToProcessEnvForTenant, BOOTSTRAP_KEYS } from "../settings/effective-config.js";

/** @type {Map<string, { overlay: Map<string,string>, loadedAt: number }>} */
const tenantCache = new Map();
const CACHE_TTL_MS = 60_000;

export async function loadTenantOverlay(namespace) {
  if (!namespace || !namespace.startsWith("user:")) return new Map();
  const cached = tenantCache.get(namespace);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.overlay;
  }
  const rows = await listAllSettingsDecrypted(namespace);
  const overlay = new Map();
  for (const { keyName, value } of rows) {
    if (BOOTSTRAP_KEYS.has(keyName)) continue;
    overlay.set(keyName, value);
    applyToProcessEnvForTenant(keyName, value);
  }
  tenantCache.set(namespace, { overlay, loadedAt: Date.now() });
  return overlay;
}

export function invalidateTenantOverlay(namespace) {
  if (namespace) tenantCache.delete(namespace);
  else tenantCache.clear();
}

export function getTenantOverlaySync(namespace) {
  return tenantCache.get(namespace)?.overlay ?? null;
}
