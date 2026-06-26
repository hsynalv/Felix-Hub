/**
 * SLA background evaluator — ticks every 5 minutes.
 */

import { runSlaEvaluation } from "./sla.service.js";

let timer = null;
let ticking = false;

export const SLA_TICK_MS = 5 * 60_000;

export async function tickSla() {
  if (ticking) return { skipped: true };
  ticking = true;
  try {
    return await runSlaEvaluation();
  } finally {
    ticking = false;
  }
}

export function startSlaRunner() {
  if (timer) clearInterval(timer);
  if (process.env.NODE_ENV === "test" && process.env.SLA_RUNNER_ENABLED !== "true") {
    return;
  }
  if (process.env.SLA_RUNNER_ENABLED === "false") {
    console.log("[sla] runner disabled via SLA_RUNNER_ENABLED=false");
    return;
  }

  timer = setInterval(() => {
    tickSla().catch((err) => console.warn("[sla] tick error:", err.message));
  }, SLA_TICK_MS);

  timer.unref?.();
  console.log("[sla] runner started (5m tick)");
}

export function stopSlaRunner() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
