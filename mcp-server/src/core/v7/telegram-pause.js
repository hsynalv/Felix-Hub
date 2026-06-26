/**
 * V7 — Global hub pause from Telegram /stop.
 */

let paused = false;
let pausedUntil = null;
let pausedBy = null;
let pauseReason = null;

export function isHubPaused() {
  if (!paused) return false;
  if (pausedUntil && Date.now() > pausedUntil) {
    paused = false;
    pausedUntil = null;
    pausedBy = null;
    pauseReason = null;
    return false;
  }
  return true;
}

export function setHubPause({ chatId, minutes = 30, reason = "telegram_stop" } = {}) {
  paused = true;
  pausedBy = chatId ? String(chatId) : null;
  pauseReason = reason;
  pausedUntil = minutes > 0 ? Date.now() + minutes * 60_000 : null;
  return getHubPauseState();
}

export function clearHubPause() {
  paused = false;
  pausedUntil = null;
  pausedBy = null;
  pauseReason = null;
}

export function getHubPauseState() {
  return {
    paused: isHubPaused(),
    pausedUntil: pausedUntil ? new Date(pausedUntil).toISOString() : null,
    pausedBy,
    reason: pauseReason,
  };
}

export function resetHubPauseForTests() {
  clearHubPause();
}
