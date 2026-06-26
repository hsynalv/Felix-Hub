/**
 * Agent trust score computation from run history (V6.5).
 */

import { listRuns } from "../agent-runs/agent-runs.service.js";
import { getCachedTrustScore, listCachedTrustScores, upsertTrustScore } from "./trust-store.js";

function entityFromRun(run) {
  const meta = run.metadata || {};
  if (meta.skillId) return { entityType: "skill", entityId: meta.skillId };
  if (meta.templateId) return { entityType: "template", entityId: meta.templateId };
  if (meta.role) return { entityType: "role", entityId: meta.role };
  if (meta.watcherId) return { entityType: "watcher", entityId: meta.watcherId };
  return null;
}

function computeScoreFromRuns(runs) {
  if (!runs.length) {
    return {
      score: 50,
      confidence: 0,
      successRate: 0,
      totalRuns: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
  }

  const completed = runs.filter((r) => r.status === "completed").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const cancelled = runs.filter((r) => r.status === "cancelled").length;
  const terminal = completed + failed + cancelled;
  const successRate = terminal ? completed / terminal : 0;

  let score = Math.round(successRate * 100);
  score -= failed * 3;
  score -= cancelled;
  score = Math.max(0, Math.min(100, score));

  const confidence = Math.min(100, Math.round((runs.length / 20) * 100));

  return {
    score,
    confidence,
    successRate: Math.round(successRate * 1000) / 1000,
    totalRuns: runs.length,
    completed,
    failed,
    cancelled,
  };
}

export function getTrustScore(entityType, entityId) {
  const cached = getCachedTrustScore(entityType, entityId);
  if (cached) return cached;
  return {
    entityType,
    entityId,
    score: 50,
    confidence: 0,
    successRate: 0,
    totalRuns: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    source: "default",
  };
}

export async function recalculateTrustScores({ projectId = null, limit = 300 } = {}) {
  const runs = await listRuns({ projectId, limit });
  const buckets = new Map();

  for (const run of runs) {
    const entity = entityFromRun(run);
    if (!entity) continue;
    const key = `${entity.entityType}:${entity.entityId}`;
    if (!buckets.has(key)) buckets.set(key, { ...entity, runs: [] });
    buckets.get(key).runs.push(run);
  }

  const scores = [];
  for (const bucket of buckets.values()) {
    const metrics = computeScoreFromRuns(bucket.runs);
    const record = upsertTrustScore({
      entityType: bucket.entityType,
      entityId: bucket.entityId,
      projectId,
      ...metrics,
      source: "computed",
    });
    scores.push(record);
  }

  return scores.sort((a, b) => b.score - a.score);
}

export function listTrustScores({ entityType = null, minScore = null } = {}) {
  let scores = listCachedTrustScores();
  if (entityType) scores = scores.filter((s) => s.entityType === entityType);
  if (minScore != null) scores = scores.filter((s) => s.score >= minScore);
  return scores.sort((a, b) => b.score - a.score);
}
