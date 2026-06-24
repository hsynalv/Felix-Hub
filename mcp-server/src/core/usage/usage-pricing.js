/**
 * Model pricing per 1M tokens (USD) — shared by usage ledger and llm-router estimates
 */

export const MODEL_PRICING = {
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "o3-mini": { input: 1.1, output: 4.4 },
  "claude-opus-4-5": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 0.8, output: 4.0 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.0-pro-exp": { input: 1.25, output: 5.0 },
  "gemini-1.5-pro": { input: 1.25, output: 5.0 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "mistral-large-latest": { input: 2.0, output: 6.0 },
  "mistral-small-latest": { input: 0.2, output: 0.6 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, output: 0 },
  "text-embedding-ada-002": { input: 0.1, output: 0 },
};

export const IMAGE_PRICING_USD = {
  "dall-e-3-standard-1024": 0.04,
  "dall-e-3-standard-1792": 0.08,
  "dall-e-3-hd-1024": 0.08,
  "dall-e-3-hd-1792": 0.12,
  stability: 0.02,
};

/**
 * @param {string|null|undefined} model
 * @param {number} promptTokens
 * @param {number} completionTokens
 * @returns {number|null}
 */
export function computeCostUsd(model, promptTokens = 0, completionTokens = 0) {
  if (!model) return null;
  const price = MODEL_PRICING[model];
  if (!price) return null;
  const inputCost = (promptTokens / 1_000_000) * price.input;
  const outputCost = (completionTokens / 1_000_000) * price.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

export function estimateImageCostUsd(provider, model, size = "1024x1024", quality = "standard") {
  if (provider === "stability") return IMAGE_PRICING_USD.stability;
  const isHd = quality === "hd";
  const isLarge = size === "1792x1024" || size === "1024x1792";
  if (isHd && isLarge) return IMAGE_PRICING_USD["dall-e-3-hd-1792"];
  if (isHd) return IMAGE_PRICING_USD["dall-e-3-hd-1024"];
  if (isLarge) return IMAGE_PRICING_USD["dall-e-3-standard-1792"];
  return IMAGE_PRICING_USD["dall-e-3-standard-1024"];
}
