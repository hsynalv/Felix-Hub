/**
 * Build callTool context from an Express request (matches MCP principal fields).
 */

import { resolveEffectiveTenantId } from "./assert-tenant-boundary.js";

/**
 * @param {import("express").Request} req
 * @param {Record<string, unknown>} [extra]
 * @returns {object}
 */
export function toolContextFromRequest(req, extra = {}) {
  if (!req || typeof req !== "object") {
    return { source: "rest", tenantId: resolveEffectiveTenantId(extra), ...extra };
  }
  const tenantId =
    req.tenantId ??
    req.headers?.["x-tenant-id"]?.toString().trim() ??
    null;
  const base = {
    method: req.method,
    requestId: req.requestId,
    correlationId: req.correlationId ?? req.requestId,
    user: req.user ?? null,
    projectId: req.projectId,
    workspaceId: req.workspaceId ?? "global",
    tenantId,
    env: req.projectEnv,
    actor: req.actor ?? null,
    authScopes: req.authScopes ?? [],
    scopes: req.authScopes ?? [],
    source: "rest",
    ...extra,
  };
  base.tenantId = resolveEffectiveTenantId(base);
  return base;
}
