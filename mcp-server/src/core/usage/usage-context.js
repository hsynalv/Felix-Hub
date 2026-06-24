/**
 * Build usage ledger fields from execution context
 */

export function usageContextFromRequest(context = {}, overrides = {}) {
  return {
    source: overrides.source || context.source || inferSource(context),
    channel: overrides.channel || context.channel || inferChannel(context),
    toolName: overrides.toolName || context.toolName || null,
    pluginName: overrides.pluginName || context.pluginName || null,
    actor: context.user || context.actor || null,
    correlationId: context.requestId || context.correlationId || null,
    parentCorrelationId: context.parentCorrelationId || null,
    conversationId: context.conversationId || null,
    runId: context.runId || null,
    projectId: context.projectId || null,
    namespace: context.namespace || "default",
    ...overrides,
  };
}

function inferSource(context) {
  const method = String(context.method || "").toUpperCase();
  if (method === "UI_CHAT") return "chat_ui";
  if (method === "CHAT_TURN" || method === "TELEGRAM") return "telegram";
  if (context.pluginName) return "plugin";
  if (method.includes("HTTP")) return "http";
  return "mcp_tool";
}

function inferChannel(context) {
  if (context.channel) return context.channel;
  const source = inferSource(context);
  if (source === "chat_ui") return "web";
  if (source === "telegram") return "telegram";
  if (source === "mcp_tool") return "cursor";
  if (source === "http") return "api";
  return null;
}

/**
 * @param {object} response - OpenAI-compatible or adapter response
 * @param {string} provider
 */
export function normalizeUsageFromResponse(response, provider) {
  if (!response) return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  const usage = response.usage;
  if (usage) {
    const prompt = usage.prompt_tokens ?? usage.input_tokens ?? 0;
    const completion = usage.completion_tokens ?? usage.output_tokens ?? 0;
    const total = usage.total_tokens ?? prompt + completion;
    return { promptTokens: prompt, completionTokens: completion, totalTokens: total };
  }

  if (provider === "ollama" && response.prompt_eval_count != null) {
    const prompt = response.prompt_eval_count || 0;
    const completion = response.eval_count || 0;
    return { promptTokens: prompt, completionTokens: completion, totalTokens: prompt + completion };
  }

  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

export function mergeUsageTotals(acc, next) {
  return {
    promptTokens: (acc.promptTokens || 0) + (next.promptTokens || 0),
    completionTokens: (acc.completionTokens || 0) + (next.completionTokens || 0),
    totalTokens: (acc.totalTokens || 0) + (next.totalTokens || 0),
    estimatedCostUsd: (acc.estimatedCostUsd || 0) + (next.estimatedCostUsd || 0),
    iterations: (acc.iterations || 0) + 1,
  };
}
