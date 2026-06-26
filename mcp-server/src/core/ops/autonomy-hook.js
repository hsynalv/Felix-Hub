/**
 * Global tool execution gate — every callTool() passes L0–L5 autonomy evaluation.
 */

import { registerBeforeExecutionHook } from "../tool-hooks.js";
import { resolveAutonomyLevel, evaluateAutonomyForTool } from "./autonomy.service.js";

let registered = false;

export function registerAutonomyToolHook() {
  if (registered) return;
  registered = true;

  registerBeforeExecutionHook(async (toolName, _args, context = {}) => {
    if (context.skipAutonomyCheck === true) return null;
    if (context.dryRun || context.replay) return null;

    const projectEnv =
      context.projectEnv || context.environment || process.env.HUB_ENV || "development";

    const level = resolveAutonomyLevel({
      projectId: context.projectId ?? null,
      projectEnv,
      runbookId: context.runbookId ?? null,
      scheduleId: context.scheduleId ?? null,
      explicitLevel: context.autonomyLevel ?? null,
    });

    const verdict = evaluateAutonomyForTool({
      level,
      toolName,
      projectEnv,
      projectId: context.projectId ?? null,
      estimatedCostUsd: context.estimatedCostUsd ?? 0,
      maxCostUsd: context.maxCostUsd ?? null,
    });

    if (verdict.allowed) return null;

    const code =
      verdict.action === "require_approval" ? "autonomy_approval_required" : "autonomy_denied";

    return {
      ok: false,
      error: {
        code,
        message: verdict.reasons?.[0] || `Tool blocked at autonomy level ${verdict.level}`,
        details: { autonomy: verdict },
      },
      meta: { requestId: context.requestId },
    };
  });
}

/** @internal */
export function resetAutonomyHookForTests() {
  registered = false;
}
