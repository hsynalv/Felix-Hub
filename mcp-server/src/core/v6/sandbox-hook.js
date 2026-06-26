/**
 * Sandbox tool execution hook — mocks side effects when context.sandboxId is set (V6.4).
 */

import { registerBeforeExecutionHook } from "../tool-hooks.js";
import { getSandboxSession, recordSandboxCall } from "./sandbox-store.js";

function buildMockResult(toolName, args, session) {
  const override = session.mocks?.[toolName];
  if (override) {
    return {
      ok: true,
      data: override,
      meta: { sandboxId: session.id, mocked: true },
    };
  }

  return {
    ok: true,
    data: {
      sandboxId: session.id,
      mocked: true,
      tool: toolName,
      simulated: true,
      args,
      message: "Sandbox simulation — no side effects",
    },
    meta: { sandboxId: session.id, mocked: true },
  };
}

export function initSandboxHook() {
  registerBeforeExecutionHook(async (toolName, args, context) => {
    const sandboxId = context?.sandboxId;
    if (!sandboxId) return null;

    const session = getSandboxSession(sandboxId);
    if (!session || session.status !== "active") {
      return {
        ok: false,
        error: { code: "sandbox_invalid", message: `Invalid or closed sandbox session: ${sandboxId}` },
      };
    }

    const result = buildMockResult(toolName, args, session);
    recordSandboxCall(sandboxId, toolName, args, result.data);
    return result;
  });
}
