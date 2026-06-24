import { randomInt } from "crypto";
import { exec } from "child_process";
import { getEnvValue } from "./settings/effective-config.js";

const TOKENS = new Map();

function nowMs() {
  return Date.now();
}

function cleanupExpired() {
  const t = nowMs();
  for (const [token, exp] of TOKENS.entries()) {
    if (exp <= t) TOKENS.delete(token);
  }
}

function escapeAppleScriptString(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

async function notifyNative(title, message) {
  try {
    if (process.platform === "darwin") {
      const t = escapeAppleScriptString(title);
      const m = escapeAppleScriptString(message);
      const cmd = `osascript -e 'display notification "${m}" with title "${t}"'`;
      exec(cmd);
      return;
    }
  } catch {
    // ignore
  }
}

async function notifyTelegram(title, message) {
  const enabled = getEnvValue("TELEGRAM_NOTIFY_UI_TOKEN") === "true";
  if (!enabled) return;
  try {
    const { sendTelegram, isTelegramConfigured } = await import(
      "../plugins/notifications/channels/telegram.js"
    );
    if (!isTelegramConfigured()) return;
    await sendTelegram({ title, message });
  } catch {
    // non-fatal
  }
}

async function notify(title, message) {
  await notifyNative(title, message);
  await notifyTelegram(title, message);
}

export function issueUiToken({ ttlMs = 5 * 60 * 1000 } = {}) {
  cleanupExpired();
  let token;
  for (let i = 0; i < 10; i++) {
    token = String(randomInt(0, 1000000)).padStart(6, "0");
    if (!TOKENS.has(token)) break;
  }
  const expiresAt = nowMs() + ttlMs;
  TOKENS.set(token, expiresAt);
  return { token, expiresAt, ttlMs };
}

export function validateUiToken(token) {
  cleanupExpired();
  if (!token) return { ok: false };
  const exp = TOKENS.get(token);
  if (!exp) return { ok: false };
  if (exp <= nowMs()) {
    TOKENS.delete(token);
    return { ok: false };
  }
  return { ok: true, expiresAt: exp };
}

export async function issueUiTokenWithNotification({ ttlMs } = {}) {
  const issued = issueUiToken({ ttlMs });
  const minutes = Math.max(1, Math.round(issued.ttlMs / 60000));
  await notify(
    "MCP Hub UI Token",
    `Token (valid ~${minutes} min): ${issued.token}`
  );
  return issued;
}
