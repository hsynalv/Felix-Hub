/**
 * Runbook force execution guard — preflight/approval bypass is admin-only.
 */

const SCOPE_HIERARCHY = ["read", "write", "admin"];

function hasAdminScope(scopes = []) {
  return scopes.some((s) => {
    const norm = String(s).toLowerCase();
    return SCOPE_HIERARCHY.indexOf(norm) >= SCOPE_HIERARCHY.indexOf("admin");
  });
}

/**
 * Resolve whether force bypass is permitted.
 * @param {object} opts
 * @param {boolean} opts.requested - Client asked for force
 * @param {string[]} [opts.authScopes]
 * @param {boolean} [opts.internal] - Trusted internal caller (scheduler dry-run metadata only)
 */
export function resolveRunbookForce({ requested = false, authScopes = [], internal = false } = {}) {
  if (!requested) return { allowed: false, applied: false };
  if (internal && process.env.RUNBOOK_FORCE_INTERNAL !== "false") {
    return { allowed: true, applied: true, reason: "internal" };
  }
  if (hasAdminScope(authScopes)) {
    return { allowed: true, applied: true, reason: "admin" };
  }
  return {
    allowed: false,
    applied: false,
    reason: "force_requires_admin",
    message: "Preflight/approval bypass (force) requires admin scope",
  };
}

export function assertRunbookForceAllowed(opts) {
  const result = resolveRunbookForce(opts);
  if (opts.requested && !result.allowed) {
    throw Object.assign(new Error(result.message || "Force execution not permitted"), {
      code: "force_forbidden",
    });
  }
  return result.applied;
}
