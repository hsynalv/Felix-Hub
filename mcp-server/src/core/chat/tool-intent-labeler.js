/**
 * Intent sample labeling — rules + LLM with disagreement gate.
 */

import { TOOL_INTENTS } from "./tool-intent.js";
import { getIntentTrainConfig } from "./tool-intent-config.js";
import { addCorpusFromSample } from "./tool-intent-corpus.js";
import {
  listIntentSamples,
  updateIntentSample,
  markSampleDisagreement,
  confirmSampleIntent,
  getIntentSampleById,
} from "./tool-intent-samples.service.js";

/**
 * @param {import('./tool-intent-samples.service.js').ReturnType<typeof import('./tool-intent-samples.service.js').mapSampleRow>} sample
 */
export function applyRuleBasedLabel(sample) {
  const tools = sample.toolsUsed || [];
  const guards = sample.guardBlocks || [];
  const predicted = sample.predictedIntent;

  const hadN8nBlock = guards.some((g) => String(g.tool || g.toolName || "").startsWith("n8n_"));
  const usedBrainOrTavily = tools.some(
    (t) => t.startsWith("brain_") || t.startsWith("tavily")
  );
  if (hadN8nBlock && usedBrainOrTavily) {
    const intent = tools.some((t) => t.startsWith("tavily")) ? "external_api" : "project_context";
    return { intent, confidence: 0.85, source: "auto", reason: "guard_n8n_then_context" };
  }

  if (predicted === "general" && tools.length === 1 && tools[0].startsWith("tavily")) {
    return { intent: "external_api", confidence: 0.8, source: "auto", reason: "tavily_only" };
  }

  if (predicted === "automation" && tools.every((t) => t.startsWith("n8n_"))) {
    return { intent: "automation", confidence: 0.85, source: "auto", reason: "n8n_only" };
  }

  return null;
}

/**
 * @param {object} sample
 * @param {{ intent: string; confidence: number; reason?: string }} label
 */
export async function confirmAndAddToCorpus(sample, label, source = "llm") {
  const intent = label.intent;
  await confirmSampleIntent(sample.id, intent, { labelStatus: source });
  await addCorpusFromSample(sample.id, intent, sample.userMessage, source);
  return { ok: true, intent };
}

/**
 * @param {object} sample
 * @param {{ intent: string; confidence: number; reason?: string }} llmLabel
 */
export async function processLlmLabel(sample, llmLabel) {
  const config = getIntentTrainConfig();
  const runtimeIntent = sample.predictedIntent;

  if (
    config.requireHumanOnDisagreement &&
    llmLabel.intent !== runtimeIntent
  ) {
    await markSampleDisagreement(sample.id, {
      llmSuggestedIntent: llmLabel.intent,
      labelReason: llmLabel.reason || "llm_disagreement",
      labelConfidence: llmLabel.confidence,
    });
    return { status: "disagreement" };
  }

  if (llmLabel.confidence >= 0.9) {
    await confirmAndAddToCorpus(sample, llmLabel, "llm");
    return { status: "llm" };
  }

  await updateIntentSample(sample.id, {
    labelStatus: "pending",
    llmSuggestedIntent: llmLabel.intent,
    labelConfidence: llmLabel.confidence,
    labelReason: llmLabel.reason,
  });
  return { status: "pending" };
}

/**
 * Build LLM labeling prompt.
 * @param {object} sample
 */
export function buildLabelingPrompt(sample) {
  return `Classify the user message into exactly one tool intent.

Valid intents: ${TOOL_INTENTS.join(", ")}

User message: "${sample.userMessage}"

Runtime classifier prediction: ${sample.predictedIntent} (source: ${sample.predictionSource}, confidence: ${sample.predictedConfidence})
Tools actually used: ${(sample.toolsUsed || []).join(", ") || "none"}
Guard blocks: ${JSON.stringify(sample.guardBlocks || [])}

Reply with JSON only: {"intent":"<one of valid intents>","confidence":0.0-1.0,"reason":"brief"}`;
}

/**
 * Parse LLM JSON response.
 * @param {string} text
 */
export function parseLlmLabelResponse(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!TOOL_INTENTS.includes(parsed.intent)) return null;
    return {
      intent: parsed.intent,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      reason: String(parsed.reason || ""),
    };
  } catch {
    return null;
  }
}

/**
 * Label pending samples batch.
 * @param {{ log?: (msg: string) => void; maxBatch?: number }} [opts]
 */
export async function runLabelingBatch(opts = {}) {
  const log = opts.log || (() => {});
  const config = getIntentTrainConfig();
  const pending = await listIntentSamples({ status: "pending", limit: opts.maxBatch || 50 });
  let labeled = 0;
  let disagreements = 0;
  let auto = 0;

  for (const sample of pending) {
    const rule = applyRuleBasedLabel(sample);
    if (rule) {
      await confirmAndAddToCorpus(sample, rule, "auto");
      auto++;
      continue;
    }

    if (!config.llmLabelingEnabled) continue;

    try {
      const { routeTask } = await import("../../plugins/llm-router/index.js");
      const prompt = buildLabelingPrompt(sample);
      const result = await routeTask(
        "intent_labeling",
        prompt,
        {
          targetProvider: config.trainLlm.provider,
          model: config.trainLlm.model,
          maxTokens: 200,
          temperature: 0.1,
        },
        { source: "intent-train", operationType: "intent_labeling" }
      );
      const llmLabel = parseLlmLabelResponse(result.text || result.content || "");
      if (!llmLabel) {
        log(`Skip sample ${sample.id}: unparseable LLM response`);
        continue;
      }
      const outcome = await processLlmLabel(sample, llmLabel);
      if (outcome.status === "disagreement") disagreements++;
      else if (outcome.status === "llm") labeled++;
    } catch (err) {
      log(`Label failed for ${sample.id}: ${err.message}`);
    }
  }

  return { processed: pending.length, auto, labeled, disagreements };
}

/**
 * @param {string} sampleId
 * @param {{ choice: string; customIntent?: string; reject?: boolean; actor?: string }} body
 */
export async function resolveDisagreement(sampleId, body) {
  const sample = await getIntentSampleById(sampleId);
  if (!sample) throw Object.assign(new Error("Sample not found"), { code: "not_found" });
  if (sample.labelStatus !== "disagreement") {
    throw Object.assign(new Error("Sample is not in disagreement state"), { code: "invalid_state" });
  }

  if (body.reject) {
    await updateIntentSample(sampleId, {
      labelStatus: "rejected",
      confirmedBy: body.actor || "admin",
      confirmedAt: new Date().toISOString(),
    });
    return { status: "rejected" };
  }

  let intent;
  if (body.choice === "runtime") intent = sample.predictedIntent;
  else if (body.choice === "llm") intent = sample.llmSuggestedIntent;
  else if (body.choice === "custom" && body.customIntent) intent = body.customIntent;
  else throw Object.assign(new Error("Invalid choice"), { code: "validation_error" });

  if (!TOOL_INTENTS.includes(intent)) {
    throw Object.assign(new Error("Invalid intent"), { code: "validation_error" });
  }

  await confirmSampleIntent(sampleId, intent, { confirmedBy: body.actor || "admin" });
  await addCorpusFromSample(sampleId, intent, sample.userMessage, "manual");
  return { status: "confirmed", intent };
}
