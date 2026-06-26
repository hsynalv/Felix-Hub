/**
 * Authentication & RBAC middleware.
 *
 * Auth priority:
 *   1. Session cookie (hub_session) → per-user tenant
 *   2. Bearer HUB_*_KEY / UI token
 *   3. Open mode (dev only, no keys and no users)
 */

import { validateUiToken } from "./ui-tokens.js";
import { getCookie, SESSION_COOKIE } from "./auth/cookies.js";
import { buildUserFromSession } from "./auth/session-middleware.js";
import { validateSessionToken } from "./auth/sessions.service.js";
import { hasAnyUsers } from "./auth/users.service.js";
import { getSecurityRuntime, hubKeysConfigured } from "./security/resolve-runtime-security.js";
import { emitHttpDenyHubEvent } from "./audit/emit-http-events.js";

const SCOPE_HIERARCHY = ["read", "write", "admin"];

/** @type {boolean|null} */
let userAuthActiveCache = null;

function normalizeScope(scope) {
  if (scope === "danger") return "admin";
  return scope;
}

const WRITE_HTTP_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requireScopeByMethod(options = {}) {
  const readScope = options.read ?? "read";
  const writeScope = options.write ?? "write";
  const pathScopes = options.pathScopes ?? {};

  return (req, res, next) => {
    const pathKey = req.path || "";
    const override = Object.entries(pathScopes).find(([prefix]) => pathKey === prefix || pathKey.endsWith(prefix));
    const scope = override
      ? override[1]
      : WRITE_HTTP_METHODS.has(req.method.toUpperCase())
        ? writeScope
        : readScope;
    return requireScope(scope)(req, res, next);
  };
}

function getKeyMap() {
  const map = new Map();
  const readKey = process.env.HUB_READ_KEY?.trim();
  const writeKey = process.env.HUB_WRITE_KEY?.trim();
  const adminKey = process.env.HUB_ADMIN_KEY?.trim();

  if (readKey) map.set(readKey, ["read"]);
  if (writeKey) map.set(writeKey, ["read", "write"]);
  if (adminKey) map.set(adminKey, ["read", "write", "admin"]);

  return map;
}

export async function isUserAuthActive() {
  if (userAuthActiveCache !== null) return userAuthActiveCache;
  userAuthActiveCache = await hasAnyUsers();
  return userAuthActiveCache;
}

export function invalidateUserAuthCache() {
  userAuthActiveCache = null;
}

function authEnabledSync() {
  return hubKeysConfigured();
}

export async function authEnabled() {
  if (hubKeysConfigured()) return true;
  return isUserAuthActive();
}

export function extractAuthKey(req) {
  const auth = req.headers?.["authorization"] ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const headerKey =
    req.headers?.["x-hub-api-key"]?.trim() ?? req.headers?.["x-api-key"]?.trim() ?? null;
  if (headerKey) return headerKey;
  const queryToken = req.query?.access_token || req.query?.token;
  if (typeof queryToken === "string" && queryToken.trim()) return queryToken.trim();
  return null;
}

function extractKey(req) {
  return extractAuthKey(req);
}

function actorFromUser(user) {
  return {
    type: "user",
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    namespace: user.namespace,
    scopes: user.scopes,
  };
}

async function authenticateSession(req) {
  if (req.user) {
    return {
      authenticated: true,
      scopes: req.user.scopes,
      actor: actorFromUser(req.user),
      type: "session",
    };
  }
  const token = getCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const session = await validateSessionToken(token);
  if (!session) return null;
  const user = buildUserFromSession(session);
  req.user = user;
  return {
    authenticated: true,
    scopes: user.scopes,
    actor: actorFromUser(user),
    type: "session",
  };
}

export function resolveApiKeyOrUiToken(key) {
  if (!key) {
    return { valid: false };
  }

  const uiToken = validateUiToken(key);
  if (uiToken.ok) {
    const scopes = ["read", "write", "admin"];
    return {
      valid: true,
      scopes,
      type: "ui_token",
      actor: { type: "ui_token", scopes },
    };
  }

  const keyMap = getKeyMap();
  const scopes = keyMap.get(key);
  if (scopes) {
    return {
      valid: true,
      scopes: scopes.map(normalizeScope),
      type: "api_key",
      actor: { type: "api_key", scopes: scopes.map(normalizeScope) },
    };
  }

  return { valid: false };
}

export async function authenticateRequest(req) {
  const sessionAuth = await authenticateSession(req);
  if (sessionAuth) return sessionAuth;

  const enabled = await authEnabled();
  if (!enabled) {
    if (process.env.NODE_ENV === "production") {
      return { authenticated: false, scopes: [], actor: null, error: "auth_not_configured" };
    }
    return { authenticated: true, scopes: [], actor: null, type: "open" };
  }

  const key = extractKey(req);
  if (!key) {
    return { authenticated: false, scopes: [], actor: null };
  }

  const resolved = resolveApiKeyOrUiToken(key);
  if (!resolved.valid) {
    return { authenticated: false, scopes: [], actor: null };
  }

  return {
    authenticated: true,
    scopes: resolved.scopes,
    actor: resolved.actor,
    type: resolved.type,
  };
}

export function optionalAuthMiddleware(req, res, next) {
  authenticateRequest(req)
    .then((result) => {
      if (result.error === "auth_not_configured" && process.env.NODE_ENV === "production") {
        return res.status(503).json({
          ok: false,
          error: {
            code: "auth_not_configured",
            message: "Server auth is not configured.",
          },
        });
      }
      if (result.authenticated && result.scopes?.length) {
        req.authScopes = result.scopes;
        req.actor = result.actor;
      }
      next();
    })
    .catch(next);
}

export async function resolveSessionAuthPrincipal(req) {
  const sessionAuth = await authenticateSession(req);
  if (!sessionAuth) return null;
  return {
    authenticated: true,
    scopes: sessionAuth.scopes,
    actor: sessionAuth.actor,
    user: sessionAuth.actor?.email || sessionAuth.actor?.userId || "session",
    authType: "session",
  };
}

export function requireScope(scope = "read") {
  return (req, res, next) => {
    if (!req.securityContext?.authenticated) {
      void emitHttpDenyHubEvent(req, {
        source: "require_scope",
        statusCode: 401,
        errorCode: "unauthorized",
        requiredScope: scope,
      }).catch(() => {});
      return res.status(401).json({
        ok: false,
        error: {
          code: "unauthorized",
          message:
            "Security context missing. Ensure enforceSecurityContext runs before protected routes.",
        },
        meta: { requestId: req.requestId ?? null },
      });
    }

    const requiredScope = normalizeScope(scope);
    const scopes = req.securityContext.scopes || req.authScopes || [];
    const requiredIndex = SCOPE_HIERARCHY.indexOf(requiredScope);
    const hasScope = Array.isArray(scopes) && scopes.some(
      (s) => SCOPE_HIERARCHY.indexOf(normalizeScope(s)) >= requiredIndex
    );

    if (!hasScope) {
      void emitHttpDenyHubEvent(req, {
        source: "require_scope",
        statusCode: 403,
        errorCode: "forbidden",
        requiredScope: scope,
      }).catch(() => {});
      return res.status(403).json({
        ok: false,
        error: {
          code: "forbidden",
          message: `This endpoint requires '${scope}' scope. Your credentials do not have sufficient permissions.`,
        },
        meta: { requestId: req.requestId ?? null },
      });
    }

    next();
  };
}

function authorizeScope(scopes, requiredScope) {
  if (!Array.isArray(scopes)) return false;
  const required = normalizeScope(requiredScope);
  const requiredIndex = SCOPE_HIERARCHY.indexOf(required);
  return scopes.some((s) => SCOPE_HIERARCHY.indexOf(normalizeScope(s)) >= requiredIndex);
}

export function isAuthEnabled() {
  return authEnabledSync() || userAuthActiveCache === true;
}

export async function refreshAuthEnabledState() {
  const users = await hasAnyUsers();
  userAuthActiveCache = users;
  return hubKeysConfigured() || users;
}

// ── OAuth 2.1 Bearer Token Support ───────────────────────────────────────────

export async function introspectOAuthToken(token) {
  const endpoint = process.env.OAUTH_INTROSPECTION_ENDPOINT;
  if (!endpoint) {
    return null;
  }

  try {
    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const auth = process.env.OAUTH_INTROSPECTION_AUTH;
    if (auth) {
      headers["Authorization"] = `Basic ${Buffer.from(auth).toString("base64")}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: new URLSearchParams({ token }),
    });

    if (!response.ok) {
      console.error(`[auth] Token introspection failed: ${response.status}`);
      return null;
    }

    const claims = await response.json();

    if (!claims.active) {
      return null;
    }

    return claims;
  } catch (err) {
    console.error("[auth] Token introspection error:", err.message);
    return null;
  }
}

export async function validateBearerToken(token) {
  const resolved = resolveApiKeyOrUiToken(token);
  if (resolved.valid) {
    return { valid: true, scopes: resolved.scopes, type: resolved.type };
  }

  const claims = await introspectOAuthToken(token);
  if (claims) {
    const scopes = claims.scope?.split(" ") || [];
    return { valid: true, scopes, claims, type: "oauth" };
  }

  return { valid: false };
}

export function requireOAuthScope(scope = "read") {
  return async (req, res, next) => {
    if (!authEnabledSync() && !process.env.OAUTH_INTROSPECTION_ENDPOINT) {
      return next();
    }

    const token = extractKey(req);
    if (!token) {
      return res.status(401).json({
        ok: false,
        error: {
          code: "unauthorized",
          message: "Authorization header required. Use: Authorization: Bearer <token>",
        },
      });
    }

    const validation = await validateBearerToken(token);
    if (!validation.valid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: "invalid_token",
          message: "Invalid or expired token.",
        },
      });
    }

    const hasScope = authorizeScope(validation.scopes, scope);

    if (!hasScope) {
      return res.status(403).json({
        ok: false,
        error: {
          code: "insufficient_scope",
          message: `This endpoint requires '${scope}' scope. Token has: ${validation.scopes.join(", ")}`,
        },
      });
    }

    req.authScopes = validation.scopes.map(normalizeScope);
    req.actor = {
      type: validation.type,
      scopes: req.authScopes,
      ...(validation.claims?.sub ? { subject: validation.claims.sub } : {}),
    };

    next();
  };
}
