/**
 * Hybrid tool intent — regex high-confidence + optional NLP.js.
 */

import { classifyToolIntentRegex } from "./tool-intent.js";
import { getIntentTrainConfig } from "./tool-intent-config.js";
import { classifyWithNlp, getActiveModelVersion } from "./tool-intent-nlp.js";

const REGEX_FAST_PATH_CONFIDENCE = 0.9;

/**
 * @param {string} message
 * @returns {Promise<{
 *   intent: string;
 *   confidence: number;
 *   reasons: string[];
 *   source: "regex" | "nlp" | "llm_fallback";
 *   modelVersion?: number | null;
 *   needsLiveRate?: boolean;
 *   regex?: { intent: string; confidence: number };
 *   nlp?: { intent: string; confidence: number } | null;
 * }>}
 */
export async function classifyToolIntentHybrid(message) {
  const regexResult = classifyToolIntentRegex(message);
  const config = getIntentTrainConfig();

  const base = {
    ...regexResult,
    source: /** @type {"regex"} */ ("regex"),
    modelVersion: getActiveModelVersion(),
    regex: { intent: regexResult.intent, confidence: regexResult.confidence },
    nlp: null,
  };

  if (regexResult.confidence >= REGEX_FAST_PATH_CONFIDENCE) {
    return base;
  }

  if (!config.nlpRuntimeEnabled) {
    return base;
  }

  try {
    const nlpResult = await classifyWithNlp(message);
    if (!nlpResult) return base;

    base.nlp = { intent: nlpResult.intent, confidence: nlpResult.confidence };
    base.modelVersion = getActiveModelVersion();

    if (nlpResult.confidence >= config.nlpConfidenceThreshold) {
      return {
        intent: nlpResult.intent,
        confidence: nlpResult.confidence,
        reasons: [`nlp:${nlpResult.intent}`, ...regexResult.reasons.filter((r) => r !== "default")],
        source: "nlp",
        modelVersion: getActiveModelVersion(),
        needsLiveRate: regexResult.needsLiveRate,
        regex: base.regex,
        nlp: base.nlp,
      };
    }
  } catch (err) {
    console.warn("[tool-intent-hybrid] NLP classify failed:", err.message);
  }

  return base;
}

/**
 * Sync fallback for tests / callers without async.
 * @param {string} message
 */
export function classifyToolIntentSync(message) {
  const regexResult = classifyToolIntentRegex(message);
  return {
    ...regexResult,
    source: "regex",
    modelVersion: getActiveModelVersion(),
  };
}
