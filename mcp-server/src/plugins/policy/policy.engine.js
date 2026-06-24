/**
 * Policy engine — evaluates rules against incoming requests and tools.
 */

import { listRules, createApproval, checkPolicyRateLimit } from "./policy.store.js";

function globToRegex(glob) {
  return new RegExp("^" + glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
}

function matchesToolPattern(pattern, toolName) {
  if (!pattern || !toolName) return false;
  return globToRegex(pattern).test(toolName);
}

function resolveEnvironment(ctx = {}) {
  return (
    ctx.environment ||
    ctx.projectEnv ||
    process.env.HUB_ENV ||
    process.env.NODE_ENV ||
    "development"
  );
}

function matchesRuleContext(rule, ctx = {}) {
  const env = resolveEnvironment(ctx);
  if (rule.environment && rule.environment !== "*" && rule.environment !== env) return false;
  if (rule.projectId && rule.projectId !== "*" && ctx.projectId && rule.projectId !== ctx.projectId) {
    return false;
  }
  return true;
}

/**
 * Match a rule pattern against a request path.
 */
function matchesRule(rule, method, path) {
  const pattern = rule.pattern ?? "";
  if (!pattern) return false;

  const parts = pattern.split(" ");
  let ruleMethod, rulePath;

  if (parts.length === 2) {
    [ruleMethod, rulePath] = parts;
  } else {
    ruleMethod = "*";
    rulePath = parts[0];
  }

  if (ruleMethod !== "*" && ruleMethod.toUpperCase() !== method.toUpperCase()) return false;

  const rulePathRegex = new RegExp(
    "^" + rulePath.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]+") + "$"
  );

  return rulePathRegex.test(path);
}

function explain(result) {
  if (result.allowed) return "Request allowed — no matching policy rules.";
  switch (result.action) {
    case "block":
      return `Blocked by rule "${result.rule}": ${result.reason || "Policy blocks this action."}`;
    case "require_approval":
      return `Requires approval: ${result.message || "Manual approval needed."}`;
    case "dry_run":
      return `Dry-run required: ${result.message || "Add ?confirmed=true to proceed."}`;
    case "policy_rate_limit":
      return `Rate limit exceeded: ${result.reason || "Too many requests."}`;
    default:
      return result.message || result.reason || "Policy denied.";
  }
}

function applyRuleAction(rule, { method, path, body, requestedBy, toolName, context }) {
  switch (rule.action) {
    case "block": {
      const r = {
        allowed: false,
        action: "block",
        rule: rule.id,
        reason: rule.description || "Blocked by policy",
        toolName,
      };
      r.explanation = explain(r);
      return r;
    }
    case "rate_limit": {
      const result = checkPolicyRateLimit(rule);
      if (!result.allowed) {
        result.explanation = explain(result);
        return result;
      }
      return null;
    }
    case "require_approval": {
      const approval = createApproval({
        ruleId: rule.id,
        path,
        method,
        body,
        requestedBy,
        toolName,
        runId: context?.runId || null,
        riskLevel: rule.action === "block" ? "destructive" : "write",
      });
      const r = {
        allowed: false,
        action: "require_approval",
        rule: rule.id,
        approval: { id: approval.id, status: "pending", createdAt: approval.createdAt },
        message: `Requires manual approval. ID: ${approval.id}`,
        toolName,
      };
      r.explanation = explain(r);
      return r;
    }
    case "dry_run_first": {
      const r = {
        allowed: false,
        action: "dry_run",
        rule: rule.id,
        message: "Dry-run required. Use POST /tools/:name/dry-run or ?confirmed=true (admin).",
        preview: { method, path, body: body ?? null, toolName },
        toolName,
      };
      r.explanation = explain(r);
      return r;
    }
    default:
      return null;
  }
}

/**
 * Evaluate HTTP-style rules.
 */
export function evaluate(method, path, body, requestedBy, context = {}) {
  const rules = listRules().filter((r) => r.enabled !== false);

  for (const rule of rules) {
    if (!matchesRuleContext(rule, context)) continue;
    if (rule.toolPattern && context.toolName) {
      if (!matchesToolPattern(rule.toolPattern, context.toolName)) continue;
    } else if (rule.toolPattern && !context.toolName) {
      continue;
    } else if (!rule.pattern) {
      continue;
    } else if (!matchesRule(rule, method, path)) {
      continue;
    }

    const result = applyRuleAction(rule, { method, path, body, requestedBy, toolName: context.toolName, context });
    if (result) return result;
  }

  return { allowed: true, explanation: explain({ allowed: true }) };
}

/**
 * Evaluate tool-name rules (shell_*, etc.).
 */
export function evaluateTool(toolName, args, context = {}) {
  const method = context.method || "POST";
  const path = `/tools/${toolName}`;
  const ctx = { ...context, toolName };
  const rules = listRules().filter((r) => r.enabled !== false && r.toolPattern);

  for (const rule of rules) {
    if (!matchesRuleContext(rule, ctx)) continue;
    if (!matchesToolPattern(rule.toolPattern, toolName)) continue;
    const result = applyRuleAction(rule, {
      method,
      path,
      body: args,
      requestedBy: context.user || "agent",
      toolName,
      context: ctx,
    });
    if (result) return result;
  }

  return evaluate(method, path, args, context.user || "agent", ctx);
}
