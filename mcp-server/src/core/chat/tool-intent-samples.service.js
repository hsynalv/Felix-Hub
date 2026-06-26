/**
 * Intent training sample persistence.
 */

import { randomUUID } from "crypto";
import { persistenceQuery, isPersistenceHealthy } from "../persistence/index.js";

/**
 * @param {object} sample
 */
export async function recordIntentSample(sample) {
  if (!isPersistenceHealthy()) return null;

  const id = randomUUID();
  await persistenceQuery(
    `INSERT INTO intent_training_samples (
      id, user_message, predicted_intent, predicted_confidence, prediction_source,
      effective_intent, tools_used_json, guard_blocks_json, project_id, conversation_id,
      run_id, chat_profile, model_version, label_status
    ) VALUES (
      @id, @userMessage, @predictedIntent, @predictedConfidence, @predictionSource,
      @effectiveIntent, @toolsUsedJson, @guardBlocksJson, @projectId, @conversationId,
      @runId, @chatProfile, @modelVersion, 'pending'
    )`,
    {
      id,
      userMessage: (sample.userMessage || "").slice(0, 2000),
      predictedIntent: sample.predictedIntent || "general",
      predictedConfidence: sample.predictedConfidence ?? 0.5,
      predictionSource: sample.predictionSource || "regex",
      effectiveIntent: sample.effectiveIntent || null,
      toolsUsedJson: JSON.stringify(sample.toolsUsed || []),
      guardBlocksJson: JSON.stringify(sample.guardBlocks || []),
      projectId: sample.projectId || null,
      conversationId: sample.conversationId || null,
      runId: sample.runId || null,
      chatProfile: sample.chatProfile || null,
      modelVersion: sample.modelVersion ?? null,
    }
  );
  return { id };
}

/**
 * @param {{ status?: string; limit?: number }} [opts]
 */
export async function listIntentSamples({ status, limit = 50 } = {}) {
  if (!isPersistenceHealthy()) return [];

  let sql = `SELECT TOP (@limit) * FROM intent_training_samples`;
  const params = { limit: Math.min(limit, 200) };
  if (status) {
    sql += ` WHERE label_status = @status`;
    params.status = status;
  }
  sql += ` ORDER BY created_at DESC`;

  const result = await persistenceQuery(sql, params);
  return (result?.recordset ?? []).map(mapSampleRow);
}

function mapSampleRow(r) {
  return {
    id: r.id,
    userMessage: r.user_message,
    predictedIntent: r.predicted_intent,
    predictedConfidence: r.predicted_confidence,
    predictionSource: r.prediction_source,
    effectiveIntent: r.effective_intent,
    toolsUsed: safeJson(r.tools_used_json, []),
    guardBlocks: safeJson(r.guard_blocks_json, []),
    projectId: r.project_id,
    conversationId: r.conversation_id,
    runId: r.run_id,
    chatProfile: r.chat_profile,
    labelStatus: r.label_status,
    labeledIntent: r.labeled_intent,
    llmSuggestedIntent: r.llm_suggested_intent,
    userConfirmedIntent: r.user_confirmed_intent,
    labelConfidence: r.label_confidence,
    labelReason: r.label_reason,
    disagreementAt: r.disagreement_at,
    confirmedAt: r.confirmed_at,
    confirmedBy: r.confirmed_by,
    modelVersion: r.model_version,
    createdAt: r.created_at,
  };
}

function safeJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function getIntentSampleById(id) {
  if (!isPersistenceHealthy()) return null;
  const result = await persistenceQuery(
    `SELECT TOP 1 * FROM intent_training_samples WHERE id = @id`,
    { id }
  );
  const row = result?.recordset?.[0];
  return row ? mapSampleRow(row) : null;
}

export async function countSamplesByStatus() {
  if (!isPersistenceHealthy()) {
    return { pending: 0, disagreement: 0, confirmed: 0, total: 0 };
  }
  const result = await persistenceQuery(
    `SELECT label_status, COUNT(*) AS cnt FROM intent_training_samples GROUP BY label_status`
  );
  const counts = { pending: 0, disagreement: 0, confirmed: 0, total: 0 };
  for (const row of result?.recordset ?? []) {
    const s = row.label_status;
    const n = row.cnt;
    counts.total += n;
    if (s === "pending") counts.pending = n;
    if (s === "disagreement") counts.disagreement = n;
    if (s === "confirmed" || s === "auto" || s === "llm" || s === "manual") {
      counts.confirmed += n;
    }
  }
  return counts;
}

/**
 * @param {string} id
 * @param {object} patch
 */
export async function updateIntentSample(id, patch) {
  if (!isPersistenceHealthy()) return null;
  const sets = [];
  const params = { id };

  if (patch.labelStatus != null) {
    sets.push("label_status = @labelStatus");
    params.labelStatus = patch.labelStatus;
  }
  if (patch.labeledIntent != null) {
    sets.push("labeled_intent = @labeledIntent");
    params.labeledIntent = patch.labeledIntent;
  }
  if (patch.llmSuggestedIntent != null) {
    sets.push("llm_suggested_intent = @llmSuggestedIntent");
    params.llmSuggestedIntent = patch.llmSuggestedIntent;
  }
  if (patch.userConfirmedIntent != null) {
    sets.push("user_confirmed_intent = @userConfirmedIntent");
    params.userConfirmedIntent = patch.userConfirmedIntent;
  }
  if (patch.labelConfidence != null) {
    sets.push("label_confidence = @labelConfidence");
    params.labelConfidence = patch.labelConfidence;
  }
  if (patch.labelReason != null) {
    sets.push("label_reason = @labelReason");
    params.labelReason = patch.labelReason;
  }
  if (patch.disagreementAt != null) {
    sets.push("disagreement_at = @disagreementAt");
    params.disagreementAt = patch.disagreementAt;
  }
  if (patch.confirmedAt != null) {
    sets.push("confirmed_at = @confirmedAt");
    params.confirmedAt = patch.confirmedAt;
  }
  if (patch.confirmedBy != null) {
    sets.push("confirmed_by = @confirmedBy");
    params.confirmedBy = patch.confirmedBy;
  }

  if (!sets.length) return getIntentSampleById(id);
  await persistenceQuery(
    `UPDATE intent_training_samples SET ${sets.join(", ")} WHERE id = @id`,
    params
  );
  return getIntentSampleById(id);
}

export async function markSampleDisagreement(id, { llmSuggestedIntent, labelReason, labelConfidence }) {
  return updateIntentSample(id, {
    labelStatus: "disagreement",
    llmSuggestedIntent,
    labelReason,
    labelConfidence,
    disagreementAt: new Date().toISOString(),
  });
}

export async function confirmSampleIntent(id, intent, { confirmedBy = "admin", labelStatus = "confirmed" } = {}) {
  return updateIntentSample(id, {
    labelStatus,
    userConfirmedIntent: intent,
    labeledIntent: intent,
    confirmedAt: new Date().toISOString(),
    confirmedBy,
  });
}

export async function countSamplesToday() {
  if (!isPersistenceHealthy()) return 0;
  const result = await persistenceQuery(
    `SELECT COUNT(*) AS cnt FROM intent_training_samples
     WHERE created_at >= CAST(SYSUTCDATETIME() AS DATE)`
  );
  return result?.recordset?.[0]?.cnt ?? 0;
}

export async function getPredictionsLast7d() {
  if (!isPersistenceHealthy()) return {};
  const result = await persistenceQuery(
    `SELECT predicted_intent, COUNT(*) AS cnt FROM intent_training_samples
     WHERE created_at >= DATEADD(day, -7, SYSUTCDATETIME())
     GROUP BY predicted_intent`
  );
  const out = {};
  for (const row of result?.recordset ?? []) {
    out[row.predicted_intent] = row.cnt;
  }
  return out;
}
