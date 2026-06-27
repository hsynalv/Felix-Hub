/**
 * V7 — Scheduled personal daily briefing runner.
 */

import { cronMatches } from "../ops/cron-match.js";
import { getBriefingSchedule, recordBriefingScheduleRun } from "./briefing-schedule-store.js";
import { generateDailyBriefing } from "./daily-briefing.service.js";
import { pushBriefingToTelegram } from "./briefing-telegram-digest.service.js";
import { isHubPaused } from "./telegram-pause.js";

function getDateKeyInTimezone(date, timezone = "UTC") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * @param {Date} [now]
 * @param {{ force?: boolean }} [opts]
 */
export async function tickBriefingSchedule(now = new Date(), { force = false } = {}) {
  const schedule = getBriefingSchedule();
  if (!schedule.enabled && !force) {
    return { skipped: true, reason: "disabled" };
  }
  if (isHubPaused()) {
    return { skipped: true, reason: "hub_paused" };
  }

  const timezone = schedule.timezone || "Europe/Istanbul";
  const dateKey = getDateKeyInTimezone(now, timezone);
  if (!force) {
    if (schedule.lastFiredDate === dateKey) {
      return { skipped: true, reason: "already_fired_today", dateKey };
    }
    if (!cronMatches(schedule.cronExpr, now, timezone)) {
      return { skipped: true, reason: "not_due" };
    }
  }

  const briefing = await generateDailyBriefing({
    scope: schedule.scope === "project" ? "project" : "personal",
    persist: true,
  });

  let pushed = false;
  let pushError = null;
  if (schedule.pushTelegram) {
    try {
      const pushResult = await pushBriefingToTelegram(briefing, {
        actionRequiredOnly: !!schedule.actionRequiredOnly,
      });
      pushed = !!pushResult.pushed;
      if (!pushResult.pushed && pushResult.reason) {
        pushError = pushResult.reason;
      }
    } catch (err) {
      pushError = err.message;
    }
  }

  recordBriefingScheduleRun({ dateKey, pushed });
  return {
    fired: true,
    dateKey,
    pushed,
    pushError,
    itemCount: briefing.items?.length ?? 0,
    briefingId: briefing.id,
  };
}
