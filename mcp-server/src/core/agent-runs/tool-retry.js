/**
 * Transient tool error detection + retry helper.
 */

const TRANSIENT_CODES = new Set([
  "notion_rate_limited",
  "rate_limited",
  "network_error",
  "timeout",
  "econnreset",
  "etimedout",
  "service_unavailable",
]);

export function isTransientToolError(result) {
  if (!result || result.ok !== false) return false;
  const code = (result.error?.code || "").toLowerCase();
  if (TRANSIENT_CODES.has(code)) return true;
  if (result.error?.retryable === true) return true;
  const msg = (result.error?.message || "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("timeout") || msg.includes("econnreset");
}

export async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withToolRetry(fn, { maxAttempts = 3, baseDelayMs = 400 } = {}) {
  let last;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await fn(attempt);
    if (!isTransientToolError(last) || attempt === maxAttempts) return last;
    await sleep(baseDelayMs * attempt);
  }
  return last;
}
