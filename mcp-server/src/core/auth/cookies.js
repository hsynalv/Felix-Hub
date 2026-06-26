/**
 * Cookie helpers for session auth.
 */

const SESSION_COOKIE = "hub_session";
const REFRESH_COOKIE = "hub_refresh";

export { SESSION_COOKIE, REFRESH_COOKIE };

/**
 * @param {string} header
 * @returns {Record<string, string>}
 */
export function parseCookies(header) {
  const out = {};
  if (!header || typeof header !== "string") return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

/**
 * @param {import('express').Request} req
 */
export function getCookie(req, name) {
  const cookies = parseCookies(req.headers?.cookie || "");
  return cookies[name] || null;
}

function cookieFlags() {
  const secure = process.env.NODE_ENV === "production";
  const parts = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * @param {import('express').Response} res
 * @param {{ sessionToken: string; refreshToken: string; sessionMaxAgeMs: number; refreshMaxAgeMs: number }} opts
 */
export function setAuthCookies(res, { sessionToken, refreshToken, sessionMaxAgeMs, refreshMaxAgeMs }) {
  const flags = cookieFlags();
  res.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; Max-Age=${Math.floor(sessionMaxAgeMs / 1000)}; ${flags}`
  );
  res.append(
    "Set-Cookie",
    `${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; Max-Age=${Math.floor(refreshMaxAgeMs / 1000)}; ${flags}`
  );
}

/**
 * @param {import('express').Response} res
 */
export function clearAuthCookies(res) {
  const flags = cookieFlags();
  res.append("Set-Cookie", `${SESSION_COOKIE}=; Max-Age=0; ${flags}`);
  res.append("Set-Cookie", `${REFRESH_COOKIE}=; Max-Age=0; ${flags}`);
}
