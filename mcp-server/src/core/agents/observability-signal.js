/**
 * Observability error signal for incident triage — audit log + hub stats.
 */

import { getLogs, getStats } from "../audit/index.js";
import { getLatestObservabilitySignal } from "../integrations/observability-webhook-store.js";

export async function fetchObservabilityErrorSignal({ projectId = null, windowMinutes = 60 } = {}) {
  const external = getLatestObservabilitySignal({ projectId });
  if (external?.spike) {
    return {
      spike: true,
      source: external.source,
      projectId: external.projectId || projectId,
      message: external.message,
      detectedAt: external.detectedAt,
      errorCount: 1,
      samples: [external.message],
      externalSignalId: external.id,
    };
  }

  const stats = await getStats();
  const logsResult = await getLogs({ limit: 50 });
  const recentErrors = (Array.isArray(logsResult) ? logsResult : logsResult?.logs || []).filter((log) => {
    const level = String(log.level || log.type || "").toLowerCase();
    return level.includes("error") || log.type === "client_error" || log.type === "server_error";
  });

  const windowMs = windowMinutes * 60 * 1000;
  const since = Date.now() - windowMs;
  const windowErrors = recentErrors.filter((e) => {
    const t = new Date(e.timestamp || e.at || 0).getTime();
    return t >= since;
  });

  const errorRate = stats.total ? Math.round(((stats.errors ?? 0) / stats.total) * 100) : 0;
  const spike = windowErrors.length >= 3 || errorRate >= 10;

  if (!spike && windowErrors.length === 0) {
    return null;
  }

  const topMessages = windowErrors
    .slice(0, 5)
    .map((e) => e.message || e.summary || e.path || "error")
    .filter(Boolean);

  return {
    spike,
    source: "observability_audit",
    projectId,
    message:
      topMessages[0] ||
      `Error spike detected: ${windowErrors.length} errors in ${windowMinutes}m (hub error rate ${errorRate}%)`,
    detectedAt: new Date().toISOString(),
    errorCount: windowErrors.length,
    errorRatePercent: errorRate,
    samples: topMessages,
  };
}
