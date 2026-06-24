/**
 * MCP HTTP Transport
 *
 * Express middleware for MCP Streamable HTTP endpoint.
 * Handles GET/POST /mcp requests.
 */

import { handleMcpHttpMessage } from "./gateway.js";
import { validateBearerToken, isAuthEnabled } from "../core/auth.js";

/**
 * Create Express middleware for MCP HTTP endpoint
 * @returns {Function} Express middleware
 */
export function createMcpHttpMiddleware() {
  return async (req, res, next) => {
    // Mounted via app.all("/mcp", ...) → req.baseUrl is "/mcp", req.path is "/"
    const onMcpRoute = req.baseUrl === "/mcp" || req.path === "/mcp";
    if (!onMcpRoute) {
      return next();
    }

    // Security: Check origin for DNS rebinding protection
    const origin = req.headers.origin;
    if (origin && !isValidOrigin(origin)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: "invalid_origin",
          message: "Origin not allowed",
        },
      });
    }

    // Authenticate request
    const token = extractBearerToken(req);
    let authContext = { user: null, scopes: [] };

    if (token) {
      const validation = await validateBearerToken(token);
      if (validation.valid) {
        authContext = {
          user: validation.claims?.sub || "authenticated",
          scopes: validation.scopes || [],
          type: validation.type,
        };
      } else if (isAuthEnabled() || process.env.OAUTH_INTROSPECTION_ENDPOINT) {
        return res.status(401).json({
          ok: false,
          error: {
            code: "invalid_token",
            message: "Invalid or expired token.",
          },
        });
      }
    } else if (isAuthEnabled() || process.env.OAUTH_INTROSPECTION_ENDPOINT) {
      return res.status(401).json({
        ok: false,
        error: {
          code: "unauthorized",
          message: "Authorization header required. Use: Authorization: Bearer <token>",
        },
      });
    }

    try {
      // Handle GET request (SSE stream setup - simplified)
      if (req.method === "GET") {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        // Send initial session info
        res.write(`data: ${JSON.stringify({ jsonrpc: "2.0", id: 0, result: { sessionId: req.requestId } })}\n\n`);

        // Keep connection alive for SSE
        const keepAlive = setInterval(() => {
          res.write(`: ping\n\n`);
        }, 30000);

        req.on("close", () => {
          clearInterval(keepAlive);
        });

        return;
      }

      // Handle POST request (JSON-RPC messages)
      if (req.method === "POST") {
        const message = req.body;

        if (!message || typeof message !== "object") {
          return res.status(400).json({
            ok: false,
            error: {
              code: "invalid_request",
              message: "Invalid JSON-RPC message",
            },
          });
        }

        const result = await handleMcpHttpMessage(message, {
          user: authContext.user,
          scopes: authContext.scopes,
          projectId: req.projectId,
          projectEnv: req.projectEnv,
          requestId: req.requestId,
        });

        if (result === null) {
          return res.status(204).end();
        }

        return res.json({
          jsonrpc: "2.0",
          id: message.id ?? null,
          result,
        });
      }

      // Method not allowed
      return res.status(405).json({
        ok: false,
        error: {
          code: "method_not_allowed",
          message: "Only GET and POST methods are supported",
        },
      });
    } catch (err) {
      console.error("[mcp-http] error:", err);
      if (err.code === "method_not_found") {
        return res.status(404).json({
          ok: false,
          error: {
            code: "method_not_found",
            message: err.message,
          },
        });
      }
      return res.status(500).json({
        ok: false,
        error: {
          code: "internal_error",
          message: err.message || "Internal server error",
        },
      });
    }
  };
}

/**
 * Extract Bearer token from request headers
 * @param {Object} req - Express request
 * @returns {string|null}
 */
function extractBearerToken(req) {
  const auth = req.headers["authorization"] ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers["x-hub-api-key"]?.trim() ?? null;
}

/**
 * Validate origin for security
 * @param {string} origin
 * @returns {boolean}
 */
function isValidOrigin(origin) {
  // Allow localhost and common development origins
  const allowedOrigins = [
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
    /^https:\/\/localhost:\d+$/,
    /^https:\/\/127\.0\.0\.1:\d+$/,
  ];

  // In production, configure via env var
  const configuredOrigins = process.env.MCP_ALLOWED_ORIGINS?.split(",") || [];
  if (configuredOrigins.length > 0) {
    return configuredOrigins.some((allowed) => origin === allowed);
  }

  return allowedOrigins.some((pattern) => pattern.test(origin));
}
