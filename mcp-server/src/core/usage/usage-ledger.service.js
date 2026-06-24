/**
 * LLM usage ledger — persistent token/cost tracking in MSSQL
 */

import {
  persistenceQuery,
  isPersistenceHealthy,
  randomUUID,
} from "../persistence/index.js";
import { computeCostUsd } from "./usage-pricing.js";

const DEFAULT_NS = "default";
const DEFAULT_RETENTION_DAYS = 90;

function parseJson(val) {
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

function rowToEvent(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    occurredAt: row.occurred_at,
    namespace: row.namespace,
    source: row.source,
    channel: row.channel,
    toolName: row.tool_name,
    pluginName: row.plugin_name,
    operationType: row.operation_type,
    provider: row.provider,
    model: row.model,
    task: row.task,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    estimatedCostUsd: row.estimated_cost_usd != null ? Number(row.estimated_cost_usd) : null,
    actor: row.actor,
    correlationId: row.correlation_id,
    parentCorrelationId: row.parent_correlation_id,
    conversationId: row.conversation_id,
    durationMs: row.duration_ms,
    success: !!row.success,
    metadata: parseJson(row.metadata_json),
  };
}

/**
 * @param {object} event
 */
export async function recordUsageEvent(event) {
  if (!isPersistenceHealthy()) return null;

  const promptTokens = event.promptTokens ?? 0;
  const completionTokens = event.completionTokens ?? 0;
  const totalTokens = event.totalTokens ?? promptTokens + completionTokens;
  const cost =
    event.estimatedCostUsd ??
    computeCostUsd(event.model, promptTokens, completionTokens);

  const eventId = event.eventId || randomUUID();

  try {
    await persistenceQuery(
      `INSERT INTO llm_usage_events (
        event_id, namespace, source, channel, tool_name, plugin_name, operation_type,
        provider, model, task, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd,
        actor, correlation_id, parent_correlation_id, conversation_id,
        duration_ms, success, metadata_json, occurred_at
      ) VALUES (
        @eventId, @namespace, @source, @channel, @toolName, @pluginName, @operationType,
        @provider, @model, @task, @promptTokens, @completionTokens, @totalTokens, @estimatedCostUsd,
        @actor, @correlationId, @parentCorrelationId, @conversationId,
        @durationMs, @success, @metadataJson, @occurredAt
      )`,
      {
        eventId,
        namespace: event.namespace || DEFAULT_NS,
        source: event.source || "unknown",
        channel: event.channel || null,
        toolName: event.toolName || null,
        pluginName: event.pluginName || null,
        operationType: event.operationType || "chat_completion",
        provider: event.provider || null,
        model: event.model || null,
        task: event.task || null,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: cost,
        actor: event.actor || null,
        correlationId: event.correlationId || null,
        parentCorrelationId: event.parentCorrelationId || null,
        conversationId: event.conversationId || null,
        durationMs: event.durationMs ?? null,
        success: event.success !== false ? 1 : 0,
        metadataJson: event.metadata ? JSON.stringify(event.metadata) : null,
        occurredAt: event.occurredAt ? new Date(event.occurredAt) : new Date(),
      }
    );
    return eventId;
  } catch (err) {
    console.warn("[usage-ledger] record failed:", err.message);
    return null;
  }
}

function defaultDateRange(from, to) {
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from
    ? new Date(from)
    : new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { fromDate, toDate };
}

const GROUP_BY_COLUMNS = {
  tool: "tool_name",
  model: "model",
  source: "source",
  plugin: "plugin_name",
  day: "CAST(occurred_at AS DATE)",
};

/**
 * @param {object} opts
 */
export async function queryEvents({
  from,
  to,
  tool,
  source,
  model,
  conversationId,
  namespace = DEFAULT_NS,
  limit = 50,
  offset = 0,
} = {}) {
  if (!isPersistenceHealthy()) {
    return { events: [], total: 0 };
  }

  const { fromDate, toDate } = defaultDateRange(from, to);
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const safeOffset = Math.max(offset, 0);

  const conditions = [
    "namespace = @namespace",
    "occurred_at >= @fromDate",
    "occurred_at < @toDate",
    "success = 1",
  ];
  const params = { namespace, fromDate, toDate, limit: safeLimit, offset: safeOffset };

  if (tool) {
    conditions.push("tool_name = @tool");
    params.tool = tool;
  }
  if (source) {
    conditions.push("source = @source");
    params.source = source;
  }
  if (model) {
    conditions.push("model = @model");
    params.model = model;
  }
  if (conversationId) {
    conditions.push("conversation_id = @conversationId");
    params.conversationId = conversationId;
  }

  const where = conditions.join(" AND ");

  const countResult = await persistenceQuery(
    `SELECT COUNT(*) AS total FROM llm_usage_events WHERE ${where}`,
    params
  );
  const total = countResult.recordset[0]?.total ?? 0;

  const result = await persistenceQuery(
    `SELECT * FROM llm_usage_events WHERE ${where}
     ORDER BY occurred_at DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    params
  );

  return {
    events: (result.recordset || []).map(rowToEvent),
    total,
  };
}

/**
 * @param {object} opts
 */
export async function querySummary({
  from,
  to,
  groupBy = "tool",
  namespace = DEFAULT_NS,
} = {}) {
  if (!isPersistenceHealthy()) {
    return { groups: [] };
  }

  const column = GROUP_BY_COLUMNS[groupBy] || GROUP_BY_COLUMNS.tool;
  const { fromDate, toDate } = defaultDateRange(from, to);

  const result = await persistenceQuery(
    `SELECT
       ${column} AS grp_key,
       COUNT(*) AS call_count,
       SUM(prompt_tokens) AS prompt_tokens,
       SUM(completion_tokens) AS completion_tokens,
       SUM(total_tokens) AS total_tokens,
       SUM(ISNULL(estimated_cost_usd, 0)) AS estimated_cost_usd
     FROM llm_usage_events
     WHERE namespace = @namespace
       AND occurred_at >= @fromDate
       AND occurred_at < @toDate
       AND success = 1
     GROUP BY ${column}
     ORDER BY SUM(total_tokens) DESC`,
    { namespace, fromDate, toDate }
  );

  const groups = (result.recordset || []).map((row) => ({
    key: row.grp_key != null ? String(row.grp_key) : "(unknown)",
    callCount: row.call_count,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    estimatedCostUsd: Number(row.estimated_cost_usd) || 0,
  }));

  return { groups };
}

export async function queryStats({ days = 7, namespace = DEFAULT_NS } = {}) {
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
  const summary = await querySummary({ from: fromDate.toISOString(), to: toDate.toISOString(), groupBy: "tool", namespace });

  const totals = summary.groups.reduce(
    (acc, g) => ({
      callCount: acc.callCount + g.callCount,
      promptTokens: acc.promptTokens + g.promptTokens,
      completionTokens: acc.completionTokens + g.completionTokens,
      totalTokens: acc.totalTokens + g.totalTokens,
      estimatedCostUsd: acc.estimatedCostUsd + g.estimatedCostUsd,
    }),
    { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 }
  );

  return { days, ...totals, byTool: summary.groups };
}

export async function queryConversationUsage(conversationId, namespace = DEFAULT_NS) {
  if (!isPersistenceHealthy()) {
    return { conversationId, events: [], totals: null };
  }

  const result = await persistenceQuery(
    `SELECT * FROM llm_usage_events
     WHERE conversation_id = @conversationId AND namespace = @namespace AND success = 1
     ORDER BY occurred_at ASC`,
    { conversationId, namespace }
  );

  const events = (result.recordset || []).map(rowToEvent);
  const totals = events.reduce(
    (acc, e) => ({
      callCount: acc.callCount + 1,
      promptTokens: acc.promptTokens + e.promptTokens,
      completionTokens: acc.completionTokens + e.completionTokens,
      totalTokens: acc.totalTokens + e.totalTokens,
      estimatedCostUsd: acc.estimatedCostUsd + (e.estimatedCostUsd || 0),
    }),
    { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 }
  );

  return { conversationId, events, totals };
}

export async function purgeOlderThan(days = DEFAULT_RETENTION_DAYS) {
  if (!isPersistenceHealthy()) return 0;

  const result = await persistenceQuery(
    `DELETE FROM llm_usage_events WHERE occurred_at < DATEADD(day, -@days, SYSUTCDATETIME())`,
    { days }
  );
  return result.rowsAffected?.[0] ?? 0;
}

export { computeCostUsd };
