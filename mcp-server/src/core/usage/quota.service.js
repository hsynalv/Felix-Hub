/**
 * Usage quotas — soft/hard budget guardrails (MSSQL + memory fallback).
 */

import { persistenceQuery, isPersistenceHealthy, randomUUID } from "../persistence/index.js";
import { queryProjectUsage } from "./usage-ledger.service.js";

/** @type {Map<string, object>} */
const memoryQuotas = new Map();

function quotaKey(scopeType, scopeId, period) {
  return `${scopeType}:${scopeId}:${period}`;
}

function rowToQuota(row) {
  return {
    id: row.id,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    period: row.period,
    limitTokens: row.limit_tokens != null ? Number(row.limit_tokens) : null,
    limitUsd: row.limit_usd != null ? Number(row.limit_usd) : null,
    alertThreshold: Number(row.alert_threshold ?? 0.8),
    hardStop: !!row.hard_stop,
    enabled: row.enabled !== false,
  };
}

export async function listQuotas() {
  if (!isPersistenceHealthy()) {
    return [...memoryQuotas.values()];
  }
  const result = await persistenceQuery(`SELECT * FROM usage_quotas WHERE enabled = 1 ORDER BY scope_type, scope_id`);
  return (result.recordset || []).map(rowToQuota);
}

export async function upsertQuota({
  scopeType = "project",
  scopeId = "*",
  period = "monthly",
  limitTokens = null,
  limitUsd = null,
  alertThreshold = 0.8,
  hardStop = false,
}) {
  const quota = {
    id: randomUUID(),
    scopeType,
    scopeId,
    period,
    limitTokens,
    limitUsd,
    alertThreshold,
    hardStop,
    enabled: true,
  };

  if (!isPersistenceHealthy()) {
    memoryQuotas.set(quotaKey(scopeType, scopeId, period), quota);
    return quota;
  }

  await persistenceQuery(
    `MERGE usage_quotas AS t
     USING (SELECT @scopeType AS scope_type, @scopeId AS scope_id, @period AS period) AS s
     ON t.scope_type = s.scope_type AND t.scope_id = s.scope_id AND t.period = s.period
     WHEN MATCHED THEN
       UPDATE SET limit_tokens = @limitTokens, limit_usd = @limitUsd,
                  alert_threshold = @alertThreshold, hard_stop = @hardStop,
                  enabled = 1, updated_at = SYSUTCDATETIME()
     WHEN NOT MATCHED THEN
       INSERT (id, scope_type, scope_id, period, limit_tokens, limit_usd, alert_threshold, hard_stop)
       VALUES (@id, @scopeType, @scopeId, @period, @limitTokens, @limitUsd, @alertThreshold, @hardStop);`,
    {
      id: quota.id,
      scopeType,
      scopeId,
      period,
      limitTokens,
      limitUsd,
      alertThreshold,
      hardStop: hardStop ? 1 : 0,
    }
  );

  const listed = await listQuotas();
  return listed.find((q) => q.scopeType === scopeType && q.scopeId === scopeId && q.period === period) || quota;
}

async function getApplicableQuotas(projectId) {
  const all = await listQuotas();
  return all.filter(
    (q) =>
      (q.scopeType === "global" && q.scopeId === "*") ||
      (q.scopeType === "project" && (q.scopeId === projectId || q.scopeId === "*"))
  );
}

/**
 * @returns {Promise<{ allowed: boolean, warning?: boolean, reason?: string, usage?: object, quota?: object }>}
 */
export async function checkQuota({ projectId = "default", period = "monthly" } = {}) {
  const quotas = await getApplicableQuotas(projectId);
  if (!quotas.length) return { allowed: true };

  const usage = await queryProjectUsage(projectId, { days: period === "daily" ? 1 : 30 });
  const usedUsd = usage.totals?.estimatedCostUsd ?? 0;
  const usedTokens = usage.totals?.totalTokens ?? 0;

  for (const q of quotas) {
    if (q.limitUsd != null && usedUsd >= q.limitUsd) {
      if (q.hardStop) {
        return {
          allowed: false,
          reason: `Project quota exceeded: $${usedUsd.toFixed(4)} / $${q.limitUsd}`,
          usage: usage.totals,
          quota: q,
        };
      }
      return { allowed: true, warning: true, usage: usage.totals, quota: q };
    }
    if (q.limitUsd != null && usedUsd >= q.limitUsd * q.alertThreshold) {
      return { allowed: true, warning: true, usage: usage.totals, quota: q };
    }
    if (q.limitTokens != null && usedTokens >= q.limitTokens) {
      if (q.hardStop) {
        return {
          allowed: false,
          reason: `Token quota exceeded: ${usedTokens} / ${q.limitTokens}`,
          usage: usage.totals,
          quota: q,
        };
      }
      return { allowed: true, warning: true, usage: usage.totals, quota: q };
    }
  }

  return { allowed: true, usage: usage.totals };
}

export function resetQuotasForTests() {
  memoryQuotas.clear();
}
