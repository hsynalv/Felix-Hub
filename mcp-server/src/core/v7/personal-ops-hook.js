/**
 * V7 — Tool execution gate for personal desktop ops + autonomy.
 */

import {
  registerBeforeExecutionHook,
  registerAfterExecutionHook,
} from "../tool-hooks.js";
import { gateDesktopAction, afterDesktopAction, isPersonalOpsBlocked } from "./personal-ops.service.js";
import { evaluatePersonalToolPolicy } from "./personal-autonomy.service.js";

const DESKTOP_TOOLS = new Set([
  "desktop_screenshot",
  "desktop_active_window",
  "desktop_ocr",
  "desktop_click",
  "desktop_type",
  "desktop_scroll",
  "desktop_hotkey",
  "desktop_app_focus",
]);

const DESKTOP_ACTION_TOOLS = new Set([
  "desktop_click",
  "desktop_type",
  "desktop_scroll",
  "desktop_hotkey",
]);

let registered = false;

function appliesToTool(toolName, context = {}) {
  if (context.skipPersonalOpsCheck === true) return false;
  if (context.dryRun || context.replay) return false;
  if (DESKTOP_TOOLS.has(toolName)) return true;
  if (context.personalScope === true) return true;
  if (context.scope === "personal") return true;
  return false;
}

export function registerPersonalOpsHook() {
  if (registered) return;
  registered = true;

  registerBeforeExecutionHook(async (toolName, _args, context = {}) => {
    if (!appliesToTool(toolName, context)) return null;

    if (isPersonalOpsBlocked()) {
      return {
        ok: false,
        error: {
          code: "personal_ops_blocked",
          message: "Emergency stop or hub pause is active",
        },
        meta: { requestId: context.requestId },
      };
    }

    const desktopGate = gateDesktopAction({ toolName, runId: context.runId ?? null });
    if (!desktopGate.allowed) {
      return {
        ok: false,
        error: {
          code: desktopGate.code,
          message: desktopGate.message,
        },
        meta: { requestId: context.requestId },
      };
    }

    const policy = evaluatePersonalToolPolicy(toolName, context);
    if (!policy.allowed) {
      if (policy.action === "require_approval") {
        return null;
      }
      return {
        ok: false,
        error: {
          code: "personal_policy_denied",
          message: policy.reasons?.[0] || "Personal autonomy policy denied",
          details: { policy },
        },
        meta: { requestId: context.requestId },
      };
    }

    return null;
  });

  registerAfterExecutionHook(async (toolName, _args, context, result) => {
    if (!appliesToTool(toolName, context)) return;
    if (!result?.ok) return;
    if (!DESKTOP_ACTION_TOOLS.has(toolName)) return;
    afterDesktopAction({ toolName, runId: context.runId ?? null });
  });
}

/** @internal */
export function resetPersonalOpsHookForTests() {
  registered = false;
}
