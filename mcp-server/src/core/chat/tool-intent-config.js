/**
 * Intent training runtime config — UI-only (intent_training.config in MSSQL).
 */

import { getSettingDecrypted } from "../settings/settings.service.js";

export const INTENT_CONFIG_KEY = "intent_training.config";

/** @typedef {import('./tool-intent-config.js').IntentTrainConfig} IntentTrainConfig */

export const DEFAULT_INTENT_TRAIN_CONFIG = {
  nlpRuntimeEnabled: true,
  collectEnabled: true,
  pipelineEnabled: false,
  llmLabelingEnabled: false,
  trainLlm: { provider: "openai", model: "gpt-4o-mini" },
  scheduleHours: 24,
  minPendingForTrain: 25,
  nlpConfidenceThreshold: 0.75,
  runtimeLlmFallback: false,
  requireHumanOnDisagreement: true,
  redactSamples: true,
  privateMode: false,
};

/** @type {IntentTrainConfig | null} */
let cachedConfig = null;
/** @type {number} */
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5_000;

/**
 * @param {unknown} raw
 * @returns {IntentTrainConfig}
 */
export function normalizeIntentTrainConfig(raw) {
  const base = { ...DEFAULT_INTENT_TRAIN_CONFIG };
  if (!raw || typeof raw !== "object") return base;
  const o = /** @type {Record<string, unknown>} */ (raw);
  return {
    nlpRuntimeEnabled: o.nlpRuntimeEnabled !== false,
    collectEnabled: o.collectEnabled !== false,
    pipelineEnabled: o.pipelineEnabled === true,
    llmLabelingEnabled: o.llmLabelingEnabled === true,
    trainLlm: {
      provider:
        typeof o.trainLlm === "object" && o.trainLlm && "provider" in o.trainLlm
          ? String(/** @type {{ provider?: string }} */ (o.trainLlm).provider || "openai")
          : base.trainLlm.provider,
      model:
        typeof o.trainLlm === "object" && o.trainLlm && "model" in o.trainLlm
          ? String(/** @type {{ model?: string }} */ (o.trainLlm).model || base.trainLlm.model)
          : base.trainLlm.model,
    },
    scheduleHours: Number(o.scheduleHours) > 0 ? Number(o.scheduleHours) : base.scheduleHours,
    minPendingForTrain:
      Number(o.minPendingForTrain) > 0 ? Number(o.minPendingForTrain) : base.minPendingForTrain,
    nlpConfidenceThreshold:
      typeof o.nlpConfidenceThreshold === "number"
        ? o.nlpConfidenceThreshold
        : base.nlpConfidenceThreshold,
    runtimeLlmFallback: o.runtimeLlmFallback === true,
    requireHumanOnDisagreement: o.requireHumanOnDisagreement !== false,
    redactSamples: o.redactSamples !== false,
    privateMode: o.privateMode === true,
  };
}

/**
 * @returns {Promise<IntentTrainConfig>}
 */
export async function loadIntentTrainConfigFromStore() {
  try {
    const row = await getSettingDecrypted(INTENT_CONFIG_KEY);
    if (!row?.value) return { ...DEFAULT_INTENT_TRAIN_CONFIG };
    const parsed = JSON.parse(row.value);
    return normalizeIntentTrainConfig(parsed);
  } catch {
    return { ...DEFAULT_INTENT_TRAIN_CONFIG };
  }
}

/**
 * Sync read with short TTL cache (hot path).
 * @returns {IntentTrainConfig}
 */
export function getIntentTrainConfig() {
  if (cachedConfig && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedConfig;
  }
  return { ...DEFAULT_INTENT_TRAIN_CONFIG };
}

/**
 * Refresh cache from store (call on startup and after settings PUT).
 */
export async function refreshIntentTrainConfigCache() {
  cachedConfig = await loadIntentTrainConfigFromStore();
  cacheLoadedAt = Date.now();
  return cachedConfig;
}

/** @param {IntentTrainConfig} config */
export function setIntentTrainConfigForTests(config) {
  cachedConfig = normalizeIntentTrainConfig(config);
  cacheLoadedAt = Date.now();
}

export function invalidateIntentTrainConfigCache() {
  cachedConfig = null;
  cacheLoadedAt = 0;
}
