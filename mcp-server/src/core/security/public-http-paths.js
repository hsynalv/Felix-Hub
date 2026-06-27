/**
 * Paths that skip principal resolution and HTTP hub lifecycle noise (health, static UI, CORS preflight).
 */

import { wantsHtmlNavigation } from "../http/html-navigation.js";

/**
 * GET paths that are JSON APIs only (including paths that share a URL with an SPA page).
 * Browser HTML navigations to these are handled by skipForHtmlNavigation on the API route.
 * @param {string} path
 */
function isJsonOnlyGetPath(path) {
  if (path === "/health" || path === "/whoami" || path === "/openapi.json") {
    return true;
  }

  const prefixes = [
    "/audit/",
    "/jobs/",
    "/plugins/",
    "/tools/",
    "/usage/",
    "/ui/chat/",
    "/personal/",
    "/spec/",
    "/sidecar/",
    "/settings/",
    "/multi-agent/",
    "/skills/",
    "/watchers/",
    "/sandbox/",
    "/trust/",
    "/inbox/",
    "/observability",
    "/eval/",
    "/team/",
    "/agents/",
    "/reports/",
    "/sla/",
    "/env/",
    "/integrations/",
    "/marketplace/",
    "/mcp-connectors/",
    "/compliance/",
    "/nl-admin/",
    "/conflicts/",
    "/app-store/",
    "/v8/",
    "/mcp",
  ];

  return prefixes.some((prefix) => path.startsWith(prefix));
}

/**
 * @param {import("express").Request} req
 * @returns {boolean}
 */
export function isPublicSecurityPath(req) {
  if (req.method === "OPTIONS") return true;
  const p = req.path || "";

  if (p === "/health") return true;

  // SPA shell: browser refresh / deep links must not return API-key 401
  if ((req.method === "GET" || req.method === "HEAD") && wantsHtmlNavigation(req)) {
    if (!isJsonOnlyGetPath(p)) {
      return true;
    }
  }

  if (req.method === "GET" && (p === "/ui" || p === "/ui/")) {
    return true;
  }

  if (req.method === "GET" && (p.startsWith("/ui/assets/") || p.startsWith("/assets/"))) {
    return true;
  }

  if (
    req.method === "GET" &&
    (p === "/admin" || p === "/admin/" || p.startsWith("/admin/"))
  ) {
    return true;
  }

  if (req.method === "POST" && p === "/ui/token") return true;

  if (
    req.method === "POST" &&
    (p === "/auth/login" || p === "/auth/register" || p === "/auth/refresh" || p === "/auth/logout")
  ) {
    return true;
  }

  // Session probe from the UI (returns route-level 401 when logged out)
  if (req.method === "GET" && p === "/auth/me") return true;

  if (req.method === "GET" && p === "/personal/briefing/gmail/oauth/callback") return true;

  return false;
}
