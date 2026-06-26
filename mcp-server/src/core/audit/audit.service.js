/**
 * Audit Service — single write path for HTTP, tool, and plugin operations.
 */

import { auditLog, getAuditManager } from "./audit.manager.js";

/**
 * @param {Object} params
 */
export async function logHttp(params) {
  const {
    requestId,
    method,
    path,
    plugin = "core",
    duration = 0,
    statusCode,
    status,
    body,
    error,
    actor = "http",
  } = params;

  await auditLog({
    plugin,
    operation: `HTTP ${method} ${path}`,
    actor,
    workspaceId: "global",
    correlationId: requestId,
    allowed: statusCode < 400,
    success: status === "success",
    durationMs: duration,
    metadata: {
      source: "http",
      method,
      path,
      statusCode,
      status,
      ...(body ? { body } : {}),
      ...(error ? { error } : {}),
    },
  });
}

/**
 * Plugin or admin operation audit.
 * @param {Object} params — same shape as auditLog params
 */
export async function logOperation(params) {
  await auditLog({
    ...params,
    metadata: {
      source: "plugin",
      ...(params.metadata || {}),
    },
  });
}

/**
 * Tool execution audit (from tool-registry).
 * @param {Object} params
 */
export async function logToolExecution(params) {
  const {
    toolName,
    plugin,
    user = "anonymous",
    projectId,
    requestId,
    runId,
    failed = false,
    duration = 0,
  } = params;

  await auditLog({
    plugin: plugin || "core",
    operation: toolName,
    actor: user,
    workspaceId: projectId || "global",
    projectId: projectId || null,
    correlationId: requestId,
    allowed: !failed,
    success: !failed,
    durationMs: duration,
    metadata: {
      source: "tool",
      toolName,
      ...(runId ? { runId } : {}),
    },
  });
}

/** @deprecated Use logOperation — kept for existing plugin imports */
export { auditLog };

/**
 * Query unified audit events from the manager sink.
 * @param {Object} [options]
 */
export async function queryAuditEvents({
  source,
  plugin,
  operation,
  actor,
  limit = 100,
  offset = 0,
} = {}) {
  const manager = getAuditManager();
  if (!manager.initialized) {
    await manager.init();
  }

  const entries = await manager.getRecentEntries({
    limit: Math.min(limit, 500),
    offset,
    ...(plugin && { plugin: String(plugin) }),
    ...(operation && { operation: String(operation) }),
  });

  let filtered = entries;
  if (source) {
    filtered = filtered.filter((e) => e.metadata?.source === source);
  }
  if (actor) {
    filtered = filtered.filter((e) => e.actor === actor || e.metadata?.user === actor);
  }
  return filtered;
}

/**
 * Legacy HTTP log shape for /audit/logs compatibility.
 */
export async function getHttpRequestLogs({ plugin, status, limit = 100 } = {}) {
  const entries = await queryAuditEvents({ source: "http", plugin, limit: 500 });

  let logs = entries.map((e) => ({
    timestamp: e.timestamp,
    requestId: e.correlationId,
    method: e.metadata?.method,
    path: e.metadata?.path,
    plugin: e.plugin,
    duration: e.durationMs,
    statusCode: e.metadata?.statusCode,
    status: e.metadata?.status,
    ...(e.metadata?.body ? { body: e.metadata.body } : {}),
    ...(e.metadata?.error ? { error: e.metadata.error } : {}),
  }));

  if (status) {
    logs = logs.filter((l) => l.status === status);
  }

  return logs.slice(0, Math.min(limit, 500));
}

/**
 * Aggregate stats from unified audit store.
 */
export async function getAuditEventStats() {
  const entries = await queryAuditEvents({ limit: 1000 });
  const byPlugin = {};
  let total = 0;
  let errors = 0;

  for (const e of entries) {
    total++;
    if (!e.success) errors++;
    const p = e.plugin || "core";
    if (!byPlugin[p]) {
      byPlugin[p] = { total: 0, success: 0, client_error: 0, server_error: 0, avgDuration: 0, _totalDuration: 0 };
    }
    const s = byPlugin[p];
    s.total++;
    const statusKey =
      e.metadata?.status === "client_error"
        ? "client_error"
        : e.metadata?.status === "server_error"
          ? "server_error"
          : e.success
            ? "success"
            : "server_error";
    s[statusKey] = (s[statusKey] || 0) + 1;
    s._totalDuration += e.durationMs || 0;
    s.avgDuration = Math.round(s._totalDuration / s.total);
  }

  for (const s of Object.values(byPlugin)) {
    delete s._totalDuration;
  }

  return { total, errors, byPlugin };
}
