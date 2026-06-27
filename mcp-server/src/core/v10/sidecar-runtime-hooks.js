/**
 * V10 — Register all sidecar runtime hooks at hub bootstrap (idempotent).
 */

import { registerSidecarPolicyHook } from "./sidecar-policy-hook.js";
import { registerSidecarUndoHook } from "./sidecar-undo.js";
import { registerTelegramSidecarDeliveryHook } from "../v9/telegram-agent-session.js";

let registered = false;

export function registerSidecarRuntimeHooks() {
  if (registered) return;
  registered = true;
  registerSidecarPolicyHook();
  registerSidecarUndoHook();
  registerTelegramSidecarDeliveryHook();
}

/** @internal */
export function resetSidecarRuntimeHooksForTests() {
  registered = false;
}
