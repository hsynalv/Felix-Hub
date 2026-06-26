/**
 * Minimal 5-field cron matcher (minute hour dom month dow).
 * Supports *, numbers, lists, ranges, and step values.
 */

function parseField(field, min, max) {
  const values = new Set();
  for (const part of field.split(",")) {
    if (part.includes("/")) {
      const [base, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10);
      let start = min;
      let end = max;
      if (base !== "*") {
        if (base.includes("-")) {
          const [a, b] = base.split("-").map((n) => parseInt(n, 10));
          start = a;
          end = b;
        } else {
          start = parseInt(base, 10);
          end = max;
        }
      }
      for (let i = start; i <= end; i += step) values.add(i);
    } else if (part === "*") {
      for (let i = min; i <= max; i++) values.add(i);
    } else if (part.includes("-")) {
      const [a, b] = part.split("-").map((n) => parseInt(n, 10));
      for (let i = a; i <= b; i++) values.add(i);
    } else {
      values.add(parseInt(part, 10));
    }
  }
  return values;
}

function getPartsInTimezone(date, timezone = "UTC") {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    minute: parseInt(map.minute, 10),
    hour: parseInt(map.hour, 10) % 24,
    day: parseInt(map.day, 10),
    month: parseInt(map.month, 10),
    dow: weekdayMap[map.weekday] ?? 0,
  };
}

/** Returns true if cron expression matches the given instant. */
export function cronMatches(cronExpr, date = new Date(), timezone = "UTC") {
  const fields = String(cronExpr || "").trim().split(/\s+/);
  if (fields.length !== 5) return false;

  const p = getPartsInTimezone(date, timezone);
  const [minF, hourF, domF, monthF, dowF] = fields;

  const minutes = parseField(minF, 0, 59);
  const hours = parseField(hourF, 0, 23);
  const doms = parseField(domF, 1, 31);
  const months = parseField(monthF, 1, 12);
  const dows = parseField(dowF, 0, 6);

  return (
    minutes.has(p.minute) &&
    hours.has(p.hour) &&
    doms.has(p.day) &&
    months.has(p.month) &&
    dows.has(p.dow)
  );
}

/** Find next fire time within maxDays (default 366). */
export function getNextCronRun(cronExpr, from = new Date(), timezone = "UTC", maxDays = 366) {
  const start = new Date(from.getTime());
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);

  const limit = start.getTime() + maxDays * 24 * 60 * 60 * 1000;
  for (let t = start.getTime(); t < limit; t += 60_000) {
    const d = new Date(t);
    if (cronMatches(cronExpr, d, timezone)) return d;
  }
  return null;
}
