/**
 * Shared FS access helpers (approval flag, request parsing, deny envelopes).
 */

export const FS_APPROVAL_HEADER = "X-Sidecar-Fs-Approval-Granted";

/**
 * @param {{ get?: (name: string) => string, query?: Record<string, string>, body?: Record<string, unknown> }} req
 */
export function fsAccessOptsFromRequest(req) {
  return {
    approvalGranted:
      req?.get?.(FS_APPROVAL_HEADER) === "1" ||
      req?.query?.approvalGranted === "1" ||
      req?.body?.approvalGranted === true,
  };
}

/**
 * @param {{ approvalId?: string }} [context]
 */
export function fsAccessOptsFromContext(context = {}) {
  return { approvalGranted: Boolean(context.approvalId) };
}

/**
 * @param {{ code?: string, error?: string, classification?: string, requireApproval?: boolean }} check
 */
export function fsDenyEnvelope(check) {
  const code = check.code || (check.requireApproval ? "approval_required" : "access_denied");
  return {
    ok: false,
    error: {
      code,
      message: check.error,
      classification: check.classification,
      requireApproval: Boolean(check.requireApproval),
    },
  };
}
