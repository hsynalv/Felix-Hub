/**
 * Enterprise compliance — audit export, retention, admin reports (V6.9).
 */

import { queryAuditEvents } from "../audit/audit.service.js";
import { maskBody } from "../audit/index.js";
import { getCompliancePolicy, setCompliancePolicy } from "./compliance-store.js";
import { listRuns } from "../agent-runs/agent-runs.service.js";

function redactEvent(event, redactPii) {
  if (!redactPii) return event;
  const copy = { ...event };
  if (copy.metadata?.body) {
    copy.metadata = { ...copy.metadata, body: maskBody(copy.metadata.body) };
  }
  return copy;
}

export { getCompliancePolicy, setCompliancePolicy };

export async function exportAuditLog({
  from = null,
  to = null,
  actor = null,
  source = null,
  format = "json",
  limit = 500,
} = {}) {
  const policy = getCompliancePolicy();
  let events = await queryAuditEvents({ limit: Math.min(limit, 2000), actor, source });

  if (from || to) {
    const fromT = from ? new Date(from).getTime() : 0;
    const toT = to ? new Date(to).getTime() : Date.now();
    events = events.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= fromT && t <= toT;
    });
  }

  events = events.map((e) => redactEvent(e, policy.piiRedaction));

  if (format === "csv") {
    const header = "timestamp,plugin,operation,actor,success,durationMs,correlationId";
    const rows = events.map((e) =>
      [
        e.timestamp,
        e.plugin,
        JSON.stringify(e.operation || ""),
        e.actor,
        e.success,
        e.durationMs,
        e.correlationId,
      ].join(",")
    );
    return { format: "csv", content: [header, ...rows].join("\n"), count: events.length };
  }

  return { format: "json", events, count: events.length };
}

export async function getComplianceAdminReport({ projectId = null } = {}) {
  const policy = getCompliancePolicy();
  const runs = await listRuns({ projectId, limit: 200 });
  const auditSample = await queryAuditEvents({ limit: 100 });

  const failedRuns = runs.filter((r) => r.status === "failed").length;
  const auditErrors = auditSample.filter((e) => !e.success).length;

  return {
    policy,
    generatedAt: new Date().toISOString(),
    summary: {
      totalRuns: runs.length,
      failedRuns,
      auditEventsSampled: auditSample.length,
      auditErrorsInSample: auditErrors,
      legalHold: policy.legalHold,
      sso: { enabled: policy.ssoEnabled, note: policy.ssoEnabled ? "configured" : "MVP — OIDC hook pending" },
      scim: { enabled: policy.scimEnabled, note: policy.scimEnabled ? "configured" : "MVP — SCIM pending" },
    },
    retention: {
      auditDays: policy.auditRetentionDays,
      runDays: policy.runRetentionDays,
    },
  };
}
