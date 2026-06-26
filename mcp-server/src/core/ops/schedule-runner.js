/**
 * Background scheduler — ticks every minute and fires due agent schedules.
 */

import { listDueSchedules, fireSchedule } from "./schedule.service.js";

let timer = null;
let ticking = false;

export const SCHEDULE_TICK_MS = 60_000;

export async function tickSchedules() {
  if (ticking) return { skipped: true };
  ticking = true;
  const results = [];
  try {
    const due = listDueSchedules();
    for (const schedule of due) {
      try {
        const result = await fireSchedule(schedule.id, { actor: "scheduler" });
        results.push({ scheduleId: schedule.id, ...result });
      } catch (err) {
        console.warn(`[schedule] fire failed for ${schedule.id}:`, err.message);
        results.push({ scheduleId: schedule.id, fired: false, error: err.message });
      }
    }
  } finally {
    ticking = false;
  }
  return { tickedAt: new Date().toISOString(), count: results.length, results };
}

export function startScheduleRunner() {
  if (timer) clearInterval(timer);
  if (process.env.NODE_ENV === "test" && process.env.SCHEDULE_RUNNER_ENABLED !== "true") {
    return;
  }
  if (process.env.SCHEDULE_RUNNER_ENABLED === "false") {
    console.log("[schedule] runner disabled via SCHEDULE_RUNNER_ENABLED=false");
    return;
  }

  timer = setInterval(() => {
    tickSchedules().catch((err) => console.warn("[schedule] tick error:", err.message));
  }, SCHEDULE_TICK_MS);

  timer.unref?.();
  console.log("[schedule] runner started (60s tick)");
}

export function stopScheduleRunner() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
