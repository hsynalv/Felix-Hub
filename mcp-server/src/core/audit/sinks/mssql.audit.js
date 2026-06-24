/**
 * MSSQL Audit Sink — persists audit events to hub audit_archive table
 */

import { randomUUID } from "crypto";
import { AuditSink } from "../sink.interface.js";
import {
  isPersistenceHealthy,
  persistenceQuery,
} from "../../persistence/index.js";

/**
 * @typedef {import("../audit.standard.js").AuditEvent} AuditEvent
 */

export class MssqlAuditSink extends AuditSink {
  constructor(options = {}) {
    super();
    this.namespace = options.namespace || "default";
  }

  /**
   * @param {AuditEvent} entry
   */
  async write(entry) {
    if (!isPersistenceHealthy()) return;

    const payload = {
      ...(entry.metadata || {}),
      ...(entry.reason ? { reason: entry.reason } : {}),
      ...(entry.error ? { error: entry.error } : {}),
      ...(entry.resource ? { resource: entry.resource } : {}),
    };

    await persistenceQuery(
      `
      INSERT INTO audit_archive (
        event_id, event_type, plugin_name, operation, actor, scope,
        success, duration_ms, payload_json, correlation_id, namespace, occurred_at
      ) VALUES (
        @eventId, @eventType, @pluginName, @operation, @actor, @scope,
        @success, @durationMs, @payloadJson, @correlationId, @namespace, @occurredAt
      )
      `,
      {
        eventId: randomUUID(),
        eventType: entry.eventType || "tool",
        pluginName: entry.plugin,
        operation: entry.operation,
        actor: entry.actor,
        scope: entry.scope || null,
        success: entry.success ? 1 : 0,
        durationMs: entry.durationMs ?? null,
        payloadJson: Object.keys(payload).length ? JSON.stringify(payload) : null,
        correlationId: entry.correlationId,
        namespace: this.namespace,
        occurredAt: new Date(entry.timestamp),
      }
    );
  }

  async read(limit = 100, offset = 0, filters = {}) {
    if (!isPersistenceHealthy()) return [];

    let where = "WHERE namespace = @namespace";
    const params = { namespace: this.namespace, limit, offset };

    if (filters.plugin) {
      where += " AND plugin_name = @plugin";
      params.plugin = filters.plugin;
    }
    if (filters.operation) {
      where += " AND operation = @operation";
      params.operation = filters.operation;
    }
    if (filters.success !== undefined) {
      where += " AND success = @success";
      params.success = filters.success ? 1 : 0;
    }

    const result = await persistenceQuery(
      `
      SELECT event_id, event_type, plugin_name, operation, actor, scope,
             success, duration_ms, payload_json, correlation_id, occurred_at, archived_at
      FROM audit_archive
      ${where}
      ORDER BY occurred_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `,
      params
    );

    if (!result?.recordset) return [];

    return result.recordset.map((row) => ({
      timestamp: row.occurred_at?.toISOString?.() || String(row.occurred_at),
      plugin: row.plugin_name,
      operation: row.operation,
      actor: row.actor,
      workspaceId: "global",
      correlationId: row.correlation_id,
      allowed: true,
      durationMs: row.duration_ms ?? 0,
      success: !!row.success,
      eventType: row.event_type,
      metadata: row.payload_json ? JSON.parse(row.payload_json) : undefined,
    }));
  }

  async stats() {
    if (!isPersistenceHealthy()) return { count: 0, source: "mssql", available: false };
    const result = await persistenceQuery(
      "SELECT COUNT(*) AS cnt FROM audit_archive WHERE namespace = @namespace",
      { namespace: this.namespace }
    );
    return {
      count: result?.recordset?.[0]?.cnt ?? 0,
      source: "mssql",
      available: true,
    };
  }
}
