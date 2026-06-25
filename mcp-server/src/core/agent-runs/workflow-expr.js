/**
 * Simple workflow condition evaluation for template `when` expressions.
 */

import { resolveTemplateArgs } from "./workflow-templates.js";

/**
 * @param {string} expression
 * @param {Record<string, string>} params
 */
export function evaluateWhen(expression, params = {}) {
  if (!expression || typeof expression !== "string") return true;
  const expr = resolveTemplateArgs(expression, params).trim();
  if (!expr) return true;

  const eqMatch = expr.match(/^(.+?)\s*===\s*['"]?(.+?)['"]?\s*$/);
  if (eqMatch) {
    return String(eqMatch[1]).trim() === String(eqMatch[2]).trim();
  }

  const neMatch = expr.match(/^(.+?)\s*!==\s*['"]?(.+?)['"]?\s*$/);
  if (neMatch) {
    return String(neMatch[1]).trim() !== String(neMatch[2]).trim();
  }

  const lower = expr.toLowerCase();
  if (lower === "true" || lower === "1" || lower === "yes") return true;
  if (lower === "false" || lower === "0" || lower === "no" || lower === "") return false;

  return Boolean(expr);
}

/**
 * Expand template steps into executable phases (handles branch steps).
 * @param {object[]} steps
 * @param {Record<string, string>} params
 */
export function expandWorkflowSteps(steps, params) {
  const phases = [];
  for (const step of steps || []) {
    if (step.type === "branch") {
      const takeTrue = evaluateWhen(step.condition, params);
      const branch = takeTrue ? step.onTrue : step.onFalse;
      if (Array.isArray(branch)) {
        phases.push(...expandWorkflowSteps(branch, params));
      }
      continue;
    }
    if (step.when && !evaluateWhen(step.when, params)) {
      continue;
    }
    phases.push({
      ...step,
      args: step.args ? resolveTemplateArgs(step.args, params) : {},
    });
  }
  return phases;
}
