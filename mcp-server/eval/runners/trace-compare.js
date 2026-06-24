/**
 * Golden trace comparison for agent workflow regression.
 */

/**
 * @param {object} golden
 * @param {Array<{ type?: string, toolName?: string, input?: object, output?: object }>} actualSteps
 * @param {{ extraSteps?: number, orderStrict?: boolean }} tolerances
 */
export function compareTrace(golden, actualSteps, tolerances = {}) {
  const expected = golden.expectedSteps || golden.steps || [];
  const extraSteps = tolerances.extraSteps ?? 0;
  const orderStrict = tolerances.orderStrict ?? true;

  const diffs = [];
  const actualTools = actualSteps
    .filter((s) => s.type === "tool" || s.toolName)
    .map((s) => ({ toolName: s.toolName, input: s.input }));

  const expectedTools = expected
    .filter((s) => s.type === "tool" || s.toolName)
    .map((s) => ({ toolName: s.toolName, argsMatch: s.argsMatch }));

  if (orderStrict) {
    const maxLen = Math.max(expectedTools.length, actualTools.length);
    for (let i = 0; i < maxLen; i++) {
      const exp = expectedTools[i];
      const act = actualTools[i];
      if (!exp && act) {
        diffs.push({ index: i, type: "extra_step", actual: act.toolName });
        continue;
      }
      if (exp && !act) {
        diffs.push({ index: i, type: "missing_step", expected: exp.toolName });
        continue;
      }
      if (exp.toolName !== act.toolName) {
        diffs.push({
          index: i,
          type: "tool_mismatch",
          expected: exp.toolName,
          actual: act.toolName,
        });
      }
    }
  } else {
    for (const exp of expectedTools) {
      const found = actualTools.some((a) => a.toolName === exp.toolName);
      if (!found) diffs.push({ type: "missing_tool", expected: exp.toolName });
    }
  }

  const extraCount = Math.max(0, actualTools.length - expectedTools.length);
  if (extraCount > extraSteps) {
    diffs.push({
      type: "too_many_extra_steps",
      expected: expectedTools.length,
      actual: actualTools.length,
      allowedExtra: extraSteps,
    });
  }

  const finalDiffs =
    extraCount <= extraSteps ? diffs.filter((d) => d.type !== "extra_step") : diffs;

  return {
    pass: finalDiffs.length === 0,
    diffs: finalDiffs,
    expectedCount: expectedTools.length,
    actualCount: actualTools.length,
  };
}

/**
 * Build synthetic steps from a workflow template plan (dry-run / golden).
 */
export function stepsFromWorkflowPlan(plan) {
  return (plan.phases || plan.steps || []).map((phase) => ({
    type: phase.type || "tool",
    toolName: phase.toolName,
    input: phase.args || phase.input,
  }));
}
