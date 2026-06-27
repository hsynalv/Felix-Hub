/**
 * Tenant boundary for tool execution (and mirrored in discovery via filterVisibleTools).
 */

/**
 * Resolve tenant id from tool context, then HUB_TENANT_ID env (single-tenant deployments).
 * @param {object} [context]
 * @returns {string|null}
 */
export function resolveEffectiveTenantId(context = {}) {
  const fromContext = context.tenantId;
  if (fromContext != null && String(fromContext).trim() !== "") {
    return String(fromContext).trim();
  }
  const fromEnv = process.env.HUB_TENANT_ID?.trim();
  return fromEnv || null;
}

/**
 * @param {object} context - tool / MCP context
 * @param {import('../security/resolve-runtime-security.js').SecurityRuntime} runtime
 * @returns {{ ok: false, error: object } | null}
 */
export function assertTenantBoundary(context = {}, runtime) {
  if (!runtime?.requireTenantId) return null;

  const tid = resolveEffectiveTenantId(context);
  if (!tid) {
    return {
      ok: false,
      error: {
        code: "missing_tenant_context",
        message:
          "Tenant context is required. Set x-tenant-id, HUB_TENANT_ID, or disable HUB_REQUIRE_TENANT_ID for non-multi-tenant deployments.",
      },
    };
  }
  return null;
}
