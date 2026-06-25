/**
 * Authentication & RBAC middleware.
 *
 * Keys and scopes (set via .env):
 *   HUB_READ_KEY   → scopes: ["read"]
 *   HUB_WRITE_KEY  → scopes: ["read", "write"]
 *   HUB_ADMIN_KEY  → scopes: ["read", "write", "admin"]
 *
 * Usage:
 *   import { requireScope } from "./auth.js";
 *   router.post("/apply", requireScope("write"), handler);
 *
 * If no keys are configured the server runs in open mode (dev-friendly).
 */

import { validateUiToken } from "./ui-tokens.js";

const SCOPE_HIERARCHY = ["read", "write", "admin"];

function normalizeScope(scope) {
  if (scope === "danger") return "admin";
  return scope;
}

const WRITE_HTTP_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Middleware: read scope for GET/HEAD/OPTIONS, write scope for mutating methods.
 * Optional pathScopes map overrides scope per path (e.g. { "/drive/upload": "admin" }).
 */
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
  const readKey  = process.env.HUB_READ_KEY?.trim();
  const writeKey = process.env.HUB_WRITE_KEY?.trim();
  const adminKey = process.env.HUB_ADMIN_KEY?.trim();

  if (readKey)  map.set(readKey,  ["read"]);
  if (writeKey) map.set(writeKey, ["read", "write"]);
  if (adminKey) map.set(adminKey, ["read", "write", "admin"]);

  return map;
}

function authEnabled() {
  return !!(
    process.env.HUB_READ_KEY?.trim() ||
    process.env.HUB_WRITE_KEY?.trim() ||
    process.env.HUB_ADMIN_KEY?.trim()
  );
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

/**
 * Resolve API key or UI token to scopes (sync).
 * @param {string} key
 * @returns {{ valid: boolean, scopes?: string[], type?: string, actor?: Object }}
 */
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

/**
 * Unified request authentication (REST) — API key + UI token.
 * @param {import('express').Request} req
 * @returns {{ authenticated: boolean, scopes: string[], actor: Object|null, type?: string }}
 */
export function authenticateRequest(req) {
  if (!authEnabled()) {
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

/**
 * Optional auth: populate req.authScopes / req.actor when a valid token is present.
 */
export function optionalAuthMiddleware(req, res, next) {
  const result = authenticateRequest(req);
  if (result.error === "auth_not_configured" && process.env.NODE_ENV === "production") {
    return res.status(503).json({
      ok: false,
      error: {
        code: "auth_not_configured",
        message: "Server auth is not configured. Set HUB_READ_KEY, HUB_WRITE_KEY, and HUB_ADMIN_KEY.",
      },
    });
  }
  if (result.authenticated && result.scopes?.length) {
    req.authScopes = result.scopes;
    req.actor = result.actor;
  }
  next();
}

function authorizeScope(scopes, requiredScope) {
  const required = normalizeScope(requiredScope);
  const requiredIndex = SCOPE_HIERARCHY.indexOf(required);
  return scopes.some((s) => SCOPE_HIERARCHY.indexOf(normalizeScope(s)) >= requiredIndex);
}

/**
 * Middleware factory.
 * requireScope("read")   — any valid key
 * requireScope("write")  — write or admin key
 * requireScope("danger") — admin key only
 */
export function requireScope(scope = "read") {
  return (req, res, next) => {
    if (!authEnabled()) {
      if (process.env.NODE_ENV === "production") {
        return res.status(503).json({
          ok: false,
          error: {
            code: "auth_not_configured",
            message: "Server auth is not configured. Set HUB_READ_KEY, HUB_WRITE_KEY, and HUB_ADMIN_KEY.",
          },
        });
      }
      return next();
    }

    const requiredScope = normalizeScope(scope);
    const auth = authenticateRequest(req);

    if (!auth.authenticated) {
      return res.status(401).json({
        ok: false,
        error: {
          code: "unauthorized",
          message: "Authorization header required. Use: Authorization: Bearer <HUB_API_KEY>",
        },
      });
    }

    req.authScopes = auth.scopes;
    req.actor = auth.actor;

    if (!authorizeScope(auth.scopes, requiredScope)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: "forbidden",
          message: `This endpoint requires '${scope}' scope.`,
        },
      });
    }

    next();
  };
}

/** Returns whether the server is running with auth enabled. */
export function isAuthEnabled() {
  return authEnabled();
}

// ── OAuth 2.1 Bearer Token Support ───────────────────────────────────────────

/**
 * OAuth 2.1 Token Introspection (RFC 7662)
 * Validates a Bearer token against an authorization server.
 *
 * Environment variables:
 *   OAUTH_INTROSPECTION_ENDPOINT - Token introspection URL
 *   OAUTH_INTROSPECTION_AUTH     - Basic auth credentials (optional)
 *
 * @param {string} token - The Bearer token to validate
 * @returns {Promise<Object|null>} Token claims or null if invalid
 */
export async function introspectOAuthToken(token) {
  const endpoint = process.env.OAUTH_INTROSPECTION_ENDPOINT;
  if (!endpoint) {
    return null;
  }

  try {
    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    // Add Basic auth if configured
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

    // RFC 7662: active=true means token is valid
    if (!claims.active) {
      return null;
    }

    return claims;
  } catch (err) {
    console.error("[auth] Token introspection error:", err.message);
    return null;
  }
}

/**
 * Validate a Bearer token (API key or OAuth 2.1)
 * @param {string} token
 * @returns {Promise<{valid: boolean, scopes?: string[], claims?: Object}>}
 */
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

/**
 * Middleware for OAuth 2.1 Bearer token validation
 * Usage: app.use('/mcp', requireOAuthScope('read'))
 *
 * @param {string} scope - Required scope
 * @returns {Function} Express middleware
 */
export function requireOAuthScope(scope = "read") {
  return async (req, res, next) => {
    // Skip if no auth configured
    if (!authEnabled() && !process.env.OAUTH_INTROSPECTION_ENDPOINT) {
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

    // Check scope
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

    // Attach auth info to request
    req.authScopes = validation.scopes.map(normalizeScope);
    req.actor = {
      type: validation.type,
      scopes: req.authScopes,
      ...(validation.claims?.sub ? { subject: validation.claims.sub } : {}),
    };

    next();
  };
}
