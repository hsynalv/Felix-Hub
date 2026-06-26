/**
 * Policy Hooks
 *
 * Extension points for the policy system to register itself with core.
 * This breaks the circular dependency: core → plugins → core
 *
 * Architecture:
 *   - Core provides empty hooks
 *   - Policy plugin registers its functions at startup
 *   - Core uses hooks to call policy functions without direct imports
 */

let policyEvaluator = null;
let evaluateToolFn = null;
let approvalStore = null;

export function registerPolicyHooks({
  evaluate,
  evaluateTool,
  createApproval,
  updateApprovalStatus,
  getApproval,
  listApprovals,
  loadPolicyConfig,
  listRules,
  addRule,
}) {
  policyEvaluator = evaluate;
  evaluateToolFn = evaluateTool || null;
  approvalStore = {
    createApproval,
    updateApprovalStatus,
    getApproval,
    listApprovals,
    loadPolicyConfig,
    ...(typeof listRules === "function" && typeof addRule === "function"
      ? { listRules, addRule }
      : {}),
  };
  console.log("[policy-hooks] Policy system registered");
}

export function getPolicyEvaluator() {
  return policyEvaluator;
}

export function getEvaluateTool() {
  return evaluateToolFn;
}

/** Get the approval store functions */
export function getApprovalStore() {
  return approvalStore;
}

/**
 * Check if policy system is registered
 * Used for graceful degradation if policy plugin is disabled
 */
export function isPolicySystemAvailable() {
  return policyEvaluator !== null && approvalStore !== null;
}
