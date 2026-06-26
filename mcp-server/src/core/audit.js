/**
 * Audit logging middleware.
 *
 * HTTP requests are logged via audit.service.js → audit manager (unified store).
 */

import { logHttp, getHttpRequestLogs, getAuditEventStats } from "./audit/audit.service.js";

const SECRET_KEYS = new Set([
  "password", "token", "secret", "key", "api_key", "apikey",
  "authorization", "access_token", "refresh_token", "credentials",
]);

export function maskBody(body) {
  if (!body || typeof body !== "object") return body;
  if (Array.isArray(body)) {
    return body.map((item) =>
      item != null && typeof item === "object" ? maskBody(item) : item
    );
  }
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    const lower = k.toLowerCase();
    const isSensitive = [...SECRET_KEYS].some((s) => lower.includes(s));
    if (isSensitive) {
      out[k] = "[REDACTED]";
    } else if (v != null && typeof v === "object") {
      out[k] = maskBody(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function inferPlugin(path) {
  const match = path.match(/^\/(n8n|credentials|github|notion|jobs|audit|openapi|http|secrets|projects|policy|observability|file-storage|database)/);
  return match ? match[1] : "core";
}

function makeRequestId() {
  return "req-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

export function auditMiddleware(req, res, next) {
  const fromHeader = req.headers["x-request-id"]?.toString().trim();
  req.requestId =
    (fromHeader && fromHeader.length > 0 ? fromHeader : null) ||
    (req.correlationId != null ? String(req.correlationId) : null) ||
    makeRequestId();
  res.setHeader("x-request-id", req.requestId);

  const start = Date.now();
  const originalJson = res.json.bind(res);
  let responseSummary = null;

  res.json = (data) => {
    if (data && typeof data === "object") {
      const { ok, error, count } = data;
      let errorSummary = null;
      if (error) {
        if (typeof error === "string") errorSummary = error;
        else if (typeof error === "object" && typeof error.code === "string") errorSummary = error.code;
      }
      responseSummary = { ok, ...(errorSummary ? { error: errorSummary } : {}), ...(count != null ? { count } : {}) };
    }
    return originalJson(data);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    const plugin = inferPlugin(req.path);
    const status =
      res.statusCode < 400 ? "success" : res.statusCode < 500 ? "client_error" : "server_error";

    const entry = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      plugin,
      duration,
      statusCode: res.statusCode,
      status,
      ...(responseSummary?.error ? { error: responseSummary.error } : {}),
    };

    if (req.method !== "GET" && req.body && Object.keys(req.body).length > 0) {
      entry.body = maskBody(req.body);
    }

    void logHttp(entry).catch((err) => {
      console.error("[audit] HTTP log failed:", err.message);
    });
  });

  next();
}

export async function getLogs(options = {}) {
  return getHttpRequestLogs(options);
}

export async function getStats() {
  return getAuditEventStats();
}
