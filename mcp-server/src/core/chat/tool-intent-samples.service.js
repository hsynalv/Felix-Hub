/**
 * Intent training sample persistence.
 */

import { randomUUID } from "crypto";
import { persistenceQuery, isPersistenceHealthy } from "../persistence/index.js";
import { redactIntentSampleText } from "./intent-sample-redaction.js";
import { getIntentTrainConfig } from "./tool-intent-config.js";

/**
 * @param {object} sample
 */
export async function recordIntentSample(sample) {
  if (!isPersistenceHealthy()) return null;

  const config = getIntentTrainConfig();
  if (config.privateMode) return null;

  let userMessage = (sample.userMessage || "").slice(0, 2000);
  if (config.redactSamples !== false) {
    userMessage = redactIntentSampleText(userMessage).text;
  }

  const id = randomUUID();
  await persistenceQuery(
    `INSERT INTO intent_training_samples (
      id, user_message, predicted_intent, predicted_confidence, prediction_source,
      effective_intent, tools_used_json, guard_blocks_json, decision_envelope_json,
      project_id, conversation_id, run_id, chat_profile, model_version, label_status
    ) VALUES (
      @id, @userMessage, @predictedIntent, @predictedConfidence, @predictionSource,
      @effectiveIntent, @toolsUsedJson, @guardBlocksJson, @decisionEnvelopeJson,
      @projectId, @conversationId, @runId, @chatProfile, @modelVersion, 'pending'
    )`,
    {
      id,
      userMessage,
      predictedIntent: sample.predictedIntent || "general",
      predictedConfidence: sample.predictedConfidence ?? 0.5,
      predictionSource: sample.predictionSource || "regex",
      effectiveIntent: sample.effectiveIntent || null,
      toolsUsedJson: JSON.stringify(sample.toolsUsed || []),
      guardBlocksJson: JSON.stringify(sample.guardBlocks || []),
      decisionEnvelopeJson: sample.decisionEnvelope ? JSON.stringify(sample.decisionEnvelope) : null,
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
    decisionEnvelope: safeJson(r.decision_envelope_json, null),
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

/**
 * User feedback from chat UI — mark prediction wrong and add corrected utterance to corpus.
 * @param {object} feedback
 */
export async function recordWrongIntentFeedback(feedback) {
  const {
    userMessage,
    predictedIntent,
    correctIntent,
    conversationId,
    runId,
    confirmedBy = "ui",
  } = feedback;

  if (!userMessage?.trim() || !correctIntent?.trim()) {
    throw Object.assign(new Error("userMessage and correctIntent required"), { code: "invalid_input" });
  }

  const config = getIntentTrainConfig();
  if (config.privateMode) {
    return { ok: true, skipped: true, reason: "private_mode" };
  }

  let redactedMessage = String(userMessage).slice(0, 2000);
  if (config.redactSamples !== false) {
    redactedMessage = redactIntentSampleText(redactedMessage).text;
  }

  let sampleId = null;
  if (isPersistenceHealthy()) {
    const match = await persistenceQuery(
      `SELECT TOP 1 id FROM intent_training_samples
       WHERE user_message = @userMessage
         AND (@predictedIntent IS NULL OR predicted_intent = @predictedIntent)
         AND (@conversationId IS NULL OR conversation_id = @conversationId)
       ORDER BY created_at DESC`,
      {
        userMessage: redactedMessage,
        predictedIntent: predictedIntent || null,
        conversationId: conversationId || null,
      }
    );
    sampleId = match?.recordset?.[0]?.id ?? null;

    if (sampleId) {
      await confirmSampleIntent(sampleId, correctIntent, { confirmedBy, labelStatus: "manual" });
    } else {
      sampleId = randomUUID();
      await persistenceQuery(
        `INSERT INTO intent_training_samples (
          id, user_message, predicted_intent, predicted_confidence, prediction_source,
          effective_intent, tools_used_json, guard_blocks_json, decision_envelope_json,
          project_id, conversation_id, run_id, chat_profile, model_version, label_status,
          labeled_intent, user_confirmed_intent, confirmed_at, confirmed_by
        ) VALUES (
          @id, @userMessage, @predictedIntent, 0.5, 'user_feedback',
          @effectiveIntent, '[]', '[]', NULL,
          NULL, @conversationId, @runId, NULL, NULL, 'manual',
          @correctIntent, @correctIntent, SYSUTCDATETIME(), @confirmedBy
        )`,
        {
          id: sampleId,
          userMessage: redactedMessage,
          predictedIntent: predictedIntent || "general",
          effectiveIntent: predictedIntent || null,
          conversationId: conversationId || null,
          runId: runId || null,
          correctIntent,
          confirmedBy,
        }
      );
    }

    const { addCorpusEntry } = await import("./tool-intent-corpus.js");
    await addCorpusEntry({
      intent: correctIntent,
      utterance: redactedMessage,
      locale: /[çğıöşü]/i.test(redactedMessage) ? "tr" : "en",
      source: "user_feedback",
      sampleId,
    });
  }

  return { ok: true, sampleId };
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
