/**
 * Desktop action guardrails — app allowlist, sensitive context detection, coordinate bounds.
 */

const DEFAULT_ALLOWED_APPS = [
  "Terminal",
  "iTerm2",
  "Cursor",
  "Code",
  "Visual Studio Code",
  "Finder",
  "Google Chrome",
  "Safari",
  "Firefox",
  "Arc",
];

const SENSITIVE_TITLE_PATTERNS = [
  /\bpassword\b/i,
  /\bpasscode\b/i,
  /\bpin\b/i,
  /\botp\b/i,
  /\b2fa\b/i,
  /\blogin\b/i,
  /\bsign[\s-]?in\b/i,
  /\bpayment\b/i,
  /\bcheckout\b/i,
  /\bcredit\s*card\b/i,
  /\bbank\b/i,
  /\bwallet\b/i,
  /\bsecurity\b/i,
  /\bauthenticate\b/i,
];

const BLOCKED_APPS = new Set(
  (process.env.DESKTOP_BLOCKED_APPS || "Keychain Access,1Password,Bitwarden,LastPass")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

function allowedApps() {
  const raw = process.env.DESKTOP_ALLOWED_APPS;
  if (!raw) return DEFAULT_ALLOWED_APPS;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAllowlistEnforced() {
  return process.env.DESKTOP_ALLOWLIST_DISABLED !== "true";
}

export function detectSensitiveContext({ app = "", title = "" } = {}) {
  const haystack = `${app} ${title}`;
  const reasons = [];

  if (BLOCKED_APPS.has(app)) {
    reasons.push(`blocked_app:${app}`);
  }

  for (const pattern of SENSITIVE_TITLE_PATTERNS) {
    if (pattern.test(haystack)) {
      reasons.push(`sensitive_title:${pattern.source}`);
    }
  }

  return {
    sensitive: reasons.length > 0,
    reasons,
  };
}

export function isAppAllowed(app) {
  if (!app) return !isAllowlistEnforced();
  if (BLOCKED_APPS.has(app)) return false;
  if (!isAllowlistEnforced()) return true;
  const list = allowedApps();
  return list.some((allowed) => app.toLowerCase().includes(allowed.toLowerCase()));
}

export function validateCoordinates({ x, y, maxX = 10000, maxY = 10000 } = {}) {
  if (x == null || y == null) {
    return { ok: false, error: { code: "invalid_coords", message: "x and y required" } };
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { ok: false, error: { code: "invalid_coords", message: "x and y must be numbers" } };
  }
  if (x < 0 || y < 0 || x > maxX || y > maxY) {
    return {
      ok: false,
      error: {
        code: "coords_out_of_bounds",
        message: `Coordinates (${x}, ${y}) outside allowed bounds 0-${maxX} x 0-${maxY}`,
      },
    };
  }
  return { ok: true, preview: { x, y } };
}

/**
 * Gate click/type actions before execution.
 * @param {{ action: string, app?: string, title?: string, x?: number, y?: number }} ctx
 */
export function assertDesktopActionAllowed(ctx = {}) {
  const coordCheck =
    ctx.action === "click" ? validateCoordinates({ x: ctx.x, y: ctx.y }) : { ok: true, preview: null };
  if (!coordCheck.ok) return coordCheck;

  const sensitivity = detectSensitiveContext({ app: ctx.app, title: ctx.title });
  if (sensitivity.sensitive) {
    return {
      ok: false,
      error: {
        code: "sensitive_context",
        message: "Desktop action blocked on sensitive screen (password/payment/login)",
        reasons: sensitivity.reasons,
        preview: { app: ctx.app, title: ctx.title, ...coordCheck.preview },
      },
    };
  }

  if (ctx.app && !isAppAllowed(ctx.app)) {
    return {
      ok: false,
      error: {
        code: "app_not_allowlisted",
        message: `App "${ctx.app}" is not in DESKTOP_ALLOWED_APPS`,
        preview: { app: ctx.app, title: ctx.title, ...coordCheck.preview },
      },
    };
  }

  return {
    ok: true,
    data: {
      allowed: true,
      preview: { app: ctx.app, title: ctx.title, action: ctx.action, ...coordCheck.preview },
    },
  };
}
