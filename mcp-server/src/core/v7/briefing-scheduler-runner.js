/**
 * Background briefing scheduler — ticks every minute for morning digest.
 */

import { tickBriefingSchedule } from "./briefing-scheduler.service.js";

let timer = null;
let ticking = false;

export const BRIEFING_SCHEDULER_TICK_MS = 60_000;

export async function tickBriefingScheduler() {
  if (ticking) return { skipped: true };
  ticking = true;
  try {
    const result = await tickBriefingSchedule();
    if (result.fired) {
      console.log(
        `[briefing-scheduler] fired date=${result.dateKey} items=${result.itemCount} telegram=${result.pushed}`,
      );
    }
    return { tickedAt: new Date().toISOString(), ...result };
  } catch (err) {
    console.warn("[briefing-scheduler] tick error:", err.message);
    return { tickedAt: new Date().toISOString(), error: err.message };
  } finally {
    ticking = false;
  }
}

export function startBriefingSchedulerRunner() {
  if (timer) clearInterval(timer);
  if (process.env.NODE_ENV === "test" && process.env.BRIEFING_SCHEDULER_ENABLED !== "true") {
    return;
  }
  if (process.env.BRIEFING_SCHEDULER_ENABLED === "false") {
    console.log("[briefing-scheduler] disabled via BRIEFING_SCHEDULER_ENABLED=false");
    return;
  }

  timer = setInterval(() => {
    tickBriefingScheduler().catch((err) => console.warn("[briefing-scheduler] interval error:", err.message));
  }, BRIEFING_SCHEDULER_TICK_MS);

  timer.unref?.();
  console.log("[briefing-scheduler] runner started (60s tick)");
}

export function stopBriefingSchedulerRunner() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
