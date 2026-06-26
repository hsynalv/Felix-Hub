/**
 * V7 — Personal ops hardening (caps, redaction, injection guard).
 */

import { detectSensitiveContext } from "../../plugins/local-sidecar/desktop-guard.js";
import {
  getPersonalOpsState,
  updatePersonalOpsConfig,
  setEmergencyStop,
  clearEmergencyStop,
  isEmergencyStopActive,
  recordDesktopAction,
  recordSpendUsd,
} from "./personal-ops-store.js";
import { isHubPaused } from "./telegram-pause.js";

const SECRET_PATTERNS = [
  /\b(sk-[a-zA-Z0-9]{20,})\b/g,
  /\b(api[_-]?key\s*[:=]\s*["']?[\w-]{8,})/gi,
  /\b(Bearer\s+[A-Za-z0-9._-]{20,})\b/g,
  /\b(password\s*[:=]\s*["']?[^\s"']+)/gi,
  /\b\d{13,19}\b/g,
];

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /do\s+not\s+follow\s+the\s+user/i,
  /click\s+here\s+to\s+approve/i,
  /enter\s+your\s+password/i,
];

const DESKTOP_ACTION_TOOLS = new Set([
  "desktop_click",
  "desktop_type",
  "desktop_scroll",
  "desktop_hotkey",
  "desktop_app_focus",
  "browser_click_selector",
  "browser_type_selector",
]);

export function getOpsDashboard() {
  const state = getPersonalOpsState();
  return {
    ...state,
    hubPaused: isHubPaused(),
    emergencyStop: isEmergencyStopActive(),
  };
}

export function updateOpsLimits(patch) {
  const allowed = {};
  for (const key of [
    "maxDailySpendUsd",
    "maxDesktopActionsPerRun",
    "maxDesktopActionsPerDay",
    "promptInjectionGuard",
    "secretRedaction",
    "paymentProtection",
  ]) {
    if (patch[key] !== undefined) allowed[key] = patch[key];
  }
  return updatePersonalOpsConfig(allowed);
}

export function triggerEmergencyStop({ minutes = 60, reason = "user_emergency_stop" } = {}) {
  const until = new Date(Date.now() + minutes * 60_000).toISOString();
  return setEmergencyStop({ until, reason });
}

export { clearEmergencyStop, isEmergencyStopActive, recordSpendUsd };

export function isPersonalOpsBlocked() {
  return isEmergencyStopActive() || isHubPaused();
}

export function gateDesktopAction({ toolName, runId = null } = {}) {
  if (isPersonalOpsBlocked()) {
    return {
      allowed: false,
      code: "emergency_stop",
      message: "Personal ops emergency stop or hub pause is active",
    };
  }

  if (!DESKTOP_ACTION_TOOLS.has(toolName)) {
    return { allowed: true };
  }

  const state = getPersonalOpsState();
  const counters = state.counters;

  if (counters.desktopActions >= state.maxDesktopActionsPerDay) {
    return {
      allowed: false,
      code: "daily_desktop_cap",
      message: `Daily desktop action cap reached (${state.maxDesktopActionsPerDay})`,
    };
  }

  if (runId) {
    const runCount = counters.runDesktopActions[runId] || 0;
    if (runCount >= state.maxDesktopActionsPerRun) {
      return {
        allowed: false,
        code: "run_desktop_cap",
        message: `Run desktop action cap reached (${state.maxDesktopActionsPerRun})`,
      };
    }
  }

  return { allowed: true };
}

export function afterDesktopAction({ toolName, runId = null } = {}) {
  if (!DESKTOP_ACTION_TOOLS.has(toolName)) return;
  recordDesktopAction({ runId });
}

export function gateSpend({ amountUsd = 0 } = {}) {
  const state = getPersonalOpsState();
  const projected = (state.counters.spendUsd || 0) + (Number(amountUsd) || 0);
  if (projected > state.maxDailySpendUsd) {
    return {
      allowed: false,
      code: "daily_spend_cap",
      message: `Daily spend cap $${state.maxDailySpendUsd} would be exceeded`,
    };
  }
  return { allowed: true };
}

export function redactSecrets(text, { enabled } = {}) {
  const state = getPersonalOpsState();
  if (enabled === false || !state.secretRedaction) return String(text || "");
  let out = String(text || "");
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }
  return out;
}

export function detectPromptInjection(screenText) {
  const state = getPersonalOpsState();
  if (!state.promptInjectionGuard) return { detected: false, reasons: [] };
  const haystack = String(screenText || "");
  const reasons = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(haystack)) reasons.push(pattern.source);
  }
  return { detected: reasons.length > 0, reasons };
}

export function evaluateScreenSafety({ app = "", title = "", ocrText = "" } = {}) {
  const state = getPersonalOpsState();
  const sensitivity = detectSensitiveContext({ app, title, ocrText });
  const injection = detectPromptInjection(ocrText || title);
  const blocked =
    (state.paymentProtection && sensitivity.sensitive) || injection.detected;

  return {
    blocked,
    sensitive: sensitivity.sensitive,
    sensitiveReasons: sensitivity.reasons,
    injectionDetected: injection.detected,
    injectionReasons: injection.reasons,
    redactedPreview: redactSecrets(`${app} — ${title}\n${(ocrText || "").slice(0, 500)}`),
  };
}
