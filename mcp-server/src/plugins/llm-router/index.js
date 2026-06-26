/**
 * Multi-LLM Router Plugin
 *
 * Routes tasks to specialized LLM providers based on capability, cost, and task type.
 * Supports multiple providers: OpenAI, Anthropic, Google, Mistral, Ollama
 */

import { Router } from "express";
import OpenAI from "openai";
import { withResilience } from "../../core/resilience.js";
import { createPluginErrorHandler } from "../../core/error-standard.js";
import { auditLog, generateCorrelationId as coreGenerateCorrelationId } from "../../core/audit/index.js";
import { createMetadata, PluginStatus, RiskLevel } from "../../core/plugins/index.js";
import { requireScopeByMethod } from "../../core/auth.js";
import { mountPluginHealth } from "../../core/plugin-health.js";
import { recordUsageEvent } from "../../core/usage/usage-ledger.service.js";
import { computeCostUsd, estimateImageCostUsd } from "../../core/usage/usage-pricing.js";
import { normalizeUsageFromResponse, usageContextFromRequest } from "../../core/usage/usage-context.js";
import {
  getProviderApiKey,
  isProviderKeyConfigured,
  getRouterProviderPreference,
  getRouterDefaultModel,
  getChatDefaultModel,
} from "../../core/llm-config.js";
import { getEnvValue } from "../../core/settings/effective-config.js";

const pluginError = createPluginErrorHandler("llm-router");

export const metadata = createMetadata({
  name: "llm-router",
  version: "1.0.0",
  description: "Multi-LLM Router Plugin - routes tasks to specialized LLM providers",
  status: PluginStatus.STABLE,
  productionReady: true,
  scopes: ["read", "write"],
  capabilities: ["llm", "ai", "routing", "completion", "chat", "audit"],
  requiresAuth: true,
  supportsAudit: true,
  supportsPolicy: false,
  supportsWorkspaceIsolation: true,
  hasTests: true,
  hasDocs: true,
  riskLevel: RiskLevel.MEDIUM,
  owner: "platform-team",
  tags: ["llm", "ai", "openai", "anthropic", "google", "mistral", "ollama"],
  dependencies: [],
  providers: ["openai", "anthropic", "google", "mistral", "ollama"],
  since: "1.0.0",
  notes: "Routes tasks to specialized LLM providers based on capability, cost, and task type.",
});

// Configuration
const DEFAULT_LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS, 10) || 60000; // 60s default
const MAX_INPUT_TOKENS = parseInt(process.env.LLM_MAX_INPUT_TOKENS, 10) || 128000;
const MAX_OUTPUT_TOKENS = parseInt(process.env.LLM_MAX_OUTPUT_TOKENS, 10) || 4096;
const MAX_PROMPT_LENGTH = parseInt(process.env.LLM_MAX_PROMPT_LENGTH, 10) || 100000; // chars

/**
 * Generate correlation ID for tracing
 */
export function generateCorrelationId() {
  return coreGenerateCorrelationId ? coreGenerateCorrelationId() : `llm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Add audit entry for LLM operations (no prompt content logged)
 */
export async function auditEntry(entry) {
  await auditLog({
    plugin: "llm-router",
    operation: entry.operation,
    actor: entry.actor || "anonymous",
    workspaceId: entry.workspaceId || "global",
    projectId: entry.projectId || null,
    correlationId: entry.correlationId,
    allowed: entry.success,
    success: entry.success,
    durationMs: entry.durationMs,
    error: entry.error || undefined,
    metadata: {
      provider: entry.provider,
      model: entry.model,
      task: entry.task,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      promptLength: entry.promptLength,
      responseLength: entry.responseLength,
      fallback: entry.fallback,
      retryCount: entry.retryCount,
    },
  });

  const status = entry.success ? "SUCCESS" : "FAILED";
  console.log(`[llm-audit] ${status} | ${entry.provider}/${entry.model} | ${entry.task} | ${entry.durationMs}ms | ${entry.correlationId}`);
}

/**
 * Get recent audit log entries
 */
export async function getAuditLogEntries(limit = 100) {
  const { getAuditManager } = await import("../../core/audit/index.js");
  const manager = getAuditManager();
  return await manager.getRecentEntries({ limit, plugin: "llm-router" });
}

/**
 * Extract context from request
 */
export function extractContext(req) {
  return {
    actor: req.user?.id || req.user?.email || "anonymous",
    workspaceId: req.workspaceId ?? null,
    projectId: req.projectId ?? null,
  };
}

/**
 * Validate prompt limits
 */
export function validatePromptLimits(prompt, maxTokens) {
  const errors = [];

  if (typeof prompt !== "string") {
    errors.push("Prompt must be a string");
    return { valid: false, errors };
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    errors.push(`Prompt exceeds max length of ${MAX_PROMPT_LENGTH} chars`);
  }

  if (maxTokens && maxTokens > MAX_OUTPUT_TOKENS) {
    errors.push(`maxTokens exceeds limit of ${MAX_OUTPUT_TOKENS}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    promptLength: prompt.length,
  };
}

export const name = "llm-router";
export const version = "1.0.0";
export const description = "Route tasks to specialized LLM providers";

// Provider configurations
const PROVIDERS = {
  openai: {
    name: "OpenAI",
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "o3-mini"],
    strengths: ["general", "coding", "analysis", "image-generation", "reasoning"],
    costTier: "medium",
    requiresKey: "OPENAI_API_KEY",
  },
  anthropic: {
    name: "Anthropic",
    models: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"],
    strengths: ["reasoning", "coding", "long-context", "analysis"],
    costTier: "high",
    requiresKey: "ANTHROPIC_API_KEY",
  },
  google: {
    name: "Google",
    models: ["gemini-2.0-flash", "gemini-2.0-pro-exp", "gemini-1.5-pro", "gemini-1.5-flash"],
    strengths: ["multilingual", "summarization", "general", "vision"],
    costTier: "low",
    requiresKey: "GOOGLE_API_KEY",
  },
  mistral: {
    name: "Mistral",
    models: ["mistral-large-latest", "mistral-small-latest"],
    strengths: ["cost-effective", "general", "coding"],
    costTier: "low",
    requiresKey: "MISTRAL_API_KEY",
  },
  ollama: {
    name: "Ollama",
    models: ["llama3.3", "qwen2.5-coder", "deepseek-r1", "phi4"],
    strengths: ["local", "privacy", "cost-free"],
    costTier: "free",
    requiresKey: null,
    requiresUrl: null,
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  },
  vllm: {
    name: "vLLM (Custom)",
    // Comma-separated model list: VLLM_MODELS="mistral-7b,llama-70b" or single VLLM_MODEL
    models: (process.env.VLLM_MODELS || process.env.VLLM_MODEL || "custom-model")
      .split(",").map(s => s.trim()).filter(Boolean),
    strengths: ["custom", "specialized", "self-hosted", "privacy", "cost-effective"],
    costTier: "custom",
    requiresKey: null,
    requiresUrl: "VLLM_BASE_URL", // must be set for provider to be available
    baseUrl: process.env.VLLM_BASE_URL || null,
    apiKey: process.env.VLLM_API_KEY || "not-needed",
  },
};

// Task routing rules - Maps task types to optimal providers
const ROUTING_RULES = [
  {
    task: "coding",
    description: "Programming, code generation, debugging",
    primary: { provider: "anthropic", model: "claude-sonnet-4-5" },
    fallback: { provider: "openai", model: "gpt-4.1" },
    priority: 1,
  },
  {
    task: "analysis",
    description: "Data analysis, reasoning, complex problem solving",
    primary: { provider: "openai", model: "gpt-4.1" },
    fallback: { provider: "anthropic", model: "claude-sonnet-4-5" },
    priority: 1,
  },
  {
    task: "documentation",
    description: "Write docs, comments, explanations",
    primary: { provider: "openai", model: "gpt-4.1-mini" },
    fallback: { provider: "mistral", model: "mistral-small-latest" },
    priority: 2,
  },
  {
    task: "fast",
    description: "Quick responses, simple queries",
    primary: { provider: "google", model: "gemini-2.0-flash" },
    fallback: { provider: "openai", model: "gpt-4o-mini" },
    priority: 3,
  },
  {
    task: "local",
    description: "Local/self-hosted models via Ollama",
    primary: { provider: "ollama", model: "llama3.3" },
    fallback: null,
    priority: 3,
  },
  {
    task: "backend_api",
    description: "Backend API development, database schemas, server logic",
    primary: { provider: "anthropic", model: "claude-opus-4-5" },
    fallback: { provider: "openai", model: "gpt-4.1" },
    priority: 1,
  },
  {
    task: "frontend_component",
    description: "React/Vue components, UI implementation",
    primary: { provider: "openai", model: "gpt-4.1" },
    fallback: { provider: "anthropic", model: "claude-sonnet-4-5" },
    priority: 1,
  },
  {
    task: "image_generation",
    description: "Generate images, logos, mockups",
    primary: { provider: "openai", model: "dall-e-3" },
    fallback: null,
    priority: 1,
  },
  {
    task: "code_review",
    description: "Review code for bugs, security, best practices",
    primary: { provider: "anthropic", model: "claude-sonnet-4-5" },
    fallback: { provider: "openai", model: "gpt-4.1" },
    priority: 1,
  },
  {
    task: "debugging",
    description: "Debug errors, analyze stack traces",
    primary: { provider: "anthropic", model: "claude-opus-4-5" },
    fallback: { provider: "openai", model: "gpt-4.1" },
    priority: 1,
  },
  {
    task: "refactoring",
    description: "Code refactoring, optimization",
    primary: { provider: "anthropic", model: "claude-sonnet-4-5" },
    fallback: { provider: "openai", model: "gpt-4.1" },
    priority: 2,
  },
  {
    task: "testing",
    description: "Write unit tests, test scenarios",
    primary: { provider: "openai", model: "gpt-4.1" },
    fallback: { provider: "anthropic", model: "claude-haiku-4-5" },
    priority: 2,
  },
  {
    task: "general",
    description: "General questions, explanations",
    primary: { provider: "openai", model: "gpt-4o-mini" },
    fallback: { provider: "mistral", model: "mistral-small-latest" },
    priority: 3,
  },
  {
    task: "complex_reasoning",
    description: "Complex analysis, architecture decisions",
    primary: { provider: "anthropic", model: "claude-opus-4-5" },
    fallback: { provider: "openai", model: "gpt-4.1" },
    priority: 1,
  },
  {
    task: "multilingual",
    description: "Tasks requiring non-English language support",
    primary: { provider: "google", model: "gemini-2.0-flash" },
    fallback: { provider: "openai", model: "gpt-4o" },
    priority: 2,
  },
  {
    task: "intent_labeling",
    description: "Tool intent corpus labeling for training pipeline",
    primary: { provider: "openai", model: "gpt-4o-mini" },
    fallback: { provider: "openai", model: "gpt-4o-mini" },
    priority: 3,
  },
  {
    task: "custom",
    description: "Route to self-hosted vLLM or any OpenAI-compatible custom endpoint",
    primary: { provider: "vllm", model: process.env.VLLM_MODEL || "custom-model" },
    fallback: { provider: "ollama", model: "llama3.3" },
    priority: 2,
  },
];

// Provider clients cache
const clients = new Map();

const PROVIDER_FALLBACK_ORDER = ["openai", "anthropic", "google", "mistral", "vllm", "ollama"];

/**
 * Runtime provider config (env may change after hot reload)
 */
export function getRuntimeProviderConfig(providerKey) {
  const base = PROVIDERS[providerKey];
  if (!base) return null;

  if (providerKey === "vllm") {
    const baseUrl = getEnvValue("VLLM_BASE_URL") || null;
    return {
      ...base,
      baseUrl,
      apiKey: getProviderApiKey("vllm") || "not-needed",
      models: (getEnvValue("VLLM_MODELS") || getEnvValue("VLLM_MODEL") || "custom-model")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  if (providerKey === "ollama") {
    return {
      ...base,
      baseUrl: getEnvValue("OLLAMA_BASE_URL") || "http://localhost:11434",
    };
  }

  return { ...base };
}

/**
 * Whether a provider has the required API key / base URL configured
 */
export function isProviderConfigured(providerKey) {
  if (providerKey === "vllm") {
    return !!getEnvValue("VLLM_BASE_URL")?.trim();
  }
  if (providerKey === "ollama") return true;
  return isProviderKeyConfigured(providerKey);
}

/**
 * Pick the first configured provider for a routing rule (primary → fallback → any available)
 */
export function resolveProviderConfig(rule, options = {}) {
  if (options.targetProvider) {
    const cfg = getRuntimeProviderConfig(options.targetProvider);
    if (!cfg) {
      throw pluginError.validation(`Unknown provider: ${options.targetProvider}`, { code: "invalid_provider" });
    }
    return {
      provider: options.targetProvider,
      model: options.model || cfg.models[0],
      usedFallback: false,
    };
  }

  const routerPref = getRouterProviderPreference();
  if (routerPref !== "auto" && isProviderConfigured(routerPref)) {
    const cfg = getRuntimeProviderConfig(routerPref);
    return {
      provider: routerPref,
      model: options.model || getRouterDefaultModel(routerPref) || cfg.models[0],
      usedFallback: false,
    };
  }

  const candidates = [];
  if (rule?.primary) candidates.push(rule.primary);
  if (rule?.fallback) candidates.push(rule.fallback);

  for (const key of PROVIDER_FALLBACK_ORDER) {
    if (!candidates.some((c) => c.provider === key) && isProviderConfigured(key)) {
      const cfg = getRuntimeProviderConfig(key);
      candidates.push({ provider: key, model: cfg.models[0] });
    }
  }

  const preferred = rule?.primary?.provider;
  for (const candidate of candidates) {
    if (!isProviderConfigured(candidate.provider)) continue;
    return {
      provider: candidate.provider,
      model: options.model || candidate.model,
      usedFallback: preferred ? candidate.provider !== preferred : false,
    };
  }

  return null;
}

/**
 * Get or create provider client
 */
function getClient(provider) {
  if (clients.has(provider)) {
    return clients.get(provider);
  }

  const config = getRuntimeProviderConfig(provider);
  if (!config) {
    throw pluginError.validation(`Unknown provider: ${provider}`);
  }

  let client;

  if (provider === "openai") {
    client = new OpenAI({
      apiKey: getProviderApiKey("openai"),
    });
  } else if (provider === "anthropic") {
    // Anthropic uses fetch API
    client = {
      chat: {
        completions: {
          create: async (params) => {
            const response = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": getProviderApiKey("anthropic"),
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: params.model,
                max_tokens: params.max_tokens || 4096,
                messages: params.messages.map(m => ({
                  role: m.role === "assistant" ? "assistant" : "user",
                  content: m.content,
                })),
              }),
            });
            const data = await response.json();
            return {
              choices: [{
                message: {
                  role: "assistant",
                  content: data.content?.[0]?.text || "",
                },
              }],
              usage: data.usage
                ? {
                    prompt_tokens: data.usage.input_tokens,
                    completion_tokens: data.usage.output_tokens,
                    total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
                  }
                : undefined,
            };
          },
        },
      },
    };
  } else if (provider === "google") {
    // Google Gemini API
    client = {
      chat: {
        completions: {
          create: async (params) => {
            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${getProviderApiKey("google")}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: params.messages.map(m => ({
                    role: m.role === "assistant" ? "model" : "user",
                    parts: [{ text: m.content }],
                  })),
                }),
              }
            );
            const data = await response.json();
            const meta = data.usageMetadata;
            return {
              choices: [{
                message: {
                  role: "assistant",
                  content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
                },
              }],
              usage: meta
                ? {
                    prompt_tokens: meta.promptTokenCount,
                    completion_tokens: meta.candidatesTokenCount,
                    total_tokens: meta.totalTokenCount,
                  }
                : undefined,
            };
          },
        },
      },
    };
  } else if (provider === "mistral") {
    // Mistral uses OpenAI-compatible API
    client = new OpenAI({
      apiKey: getProviderApiKey("mistral"),
      baseURL: "https://api.mistral.ai/v1",
    });
  } else if (provider === "ollama") {
    // Ollama local API
    client = {
      chat: {
        completions: {
          create: async (params) => {
            const response = await fetch(`${config.baseUrl}/api/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: params.model,
                messages: params.messages,
                stream: false,
              }),
            });
            const data = await response.json();
            return {
              choices: [{
                message: {
                  role: "assistant",
                  content: data.message?.content || "",
                },
              }],
              usage: {
                prompt_tokens: data.prompt_eval_count || 0,
                completion_tokens: data.eval_count || 0,
                total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
              },
              prompt_eval_count: data.prompt_eval_count,
              eval_count: data.eval_count,
            };
          },
        },
      },
    };
  } else if (provider === "vllm") {
    // vLLM — OpenAI-compatible API (also works with LM Studio, LocalAI, any OpenAI-compat server)
    if (!config.baseUrl) {
      throw pluginError.validation(
        "vLLM provider requires VLLM_BASE_URL to be configured (e.g. http://my-server:8000/v1)",
        { code: "provider_unavailable" }
      );
    }
    client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  clients.set(provider, client);
  return client;
}

/**
 * Invalidate cached vLLM client — call after runtime config change
 */
export function resetVllmClient() {
  clients.delete("vllm");
}

/** Clear all cached LLM provider clients (hot reload after API key change) */
export function clearLlmClientCache() {
  clients.clear();
}

async function recordRouteUsage(context, event) {
  const base = usageContextFromRequest(context, {
    source: context.source || "plugin",
    pluginName: "llm-router",
    toolName: context.toolName || "llm_route",
    operationType: event.operationType || "chat_completion",
  });
  await recordUsageEvent({ ...base, ...event });
}

/**
 * Route a task to the appropriate LLM with timeout governance and audit logging
 */
export async function routeTask(task, prompt, options = {}, context = {}) {
  const correlationId = generateCorrelationId();
  const startTime = Date.now();
  let retryCount = 0;

  // Validate prompt limits
  const validation = validatePromptLimits(prompt, options.maxTokens);
  if (!validation.valid) {
    auditEntry({
      operation: "route",
      provider: "(none)",
      model: "(none)",
      task,
      promptLength: validation.promptLength,
      durationMs: Date.now() - startTime,
      actor: context.actor || "anonymous",
      workspaceId: context.workspaceId || null,
      projectId: context.projectId || null,
      correlationId,
      success: false,
      error: validation.errors.join(", "),
    });
    throw pluginError.validation(validation.errors.join(", "), { code: "prompt_limit_exceeded" });
  }

  // Find routing rule
  const rule = ROUTING_RULES.find(r => r.task === task) || ROUTING_RULES.find(r => r.task === "general");

  const resolved =
    options.useFallback && rule.fallback && isProviderConfigured(rule.fallback.provider)
      ? {
          provider: rule.fallback.provider,
          model: options.model || rule.fallback.model,
          usedFallback: true,
        }
      : resolveProviderConfig(rule, options);

  if (!resolved) {
    const hint =
      "Hiçbir LLM sağlayıcısı yapılandırılmamış. OPENAI_API_KEY, VLLM_BASE_URL, OLLAMA veya başka bir provider anahtarı ekleyin.";
    auditEntry({
      operation: "route",
      provider: "(none)",
      model: "(none)",
      task,
      promptLength: validation.promptLength,
      durationMs: Date.now() - startTime,
      actor: context.actor || "anonymous",
      workspaceId: context.workspaceId || null,
      projectId: context.projectId || null,
      correlationId,
      success: false,
      error: hint,
    });
    throw pluginError.validation(hint, { code: "provider_unavailable" });
  }

  const { provider, model, usedFallback: useFallback } = resolved;
  const config = getRuntimeProviderConfig(provider);

  if (!isProviderConfigured(provider)) {
    auditEntry({
      operation: "route",
      provider,
      model,
      task,
      promptLength: validation.promptLength,
      durationMs: Date.now() - startTime,
      actor: context.actor || "anonymous",
      workspaceId: context.workspaceId || null,
      projectId: context.projectId || null,
      correlationId,
      success: false,
      error: `Provider ${provider} is not configured`,
    });
    throw pluginError.validation(`Provider ${provider} is not configured`, { code: "provider_unavailable" });
  }

  const client = getClient(provider);
  const timeoutMs = options.timeoutMs || DEFAULT_LLM_TIMEOUT_MS;

  // Promise.race-based timeout — works for all providers (OpenAI, Anthropic, Google, Ollama)
  const withLLMTimeout = (promise) => Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error(`LLM timeout after ${timeoutMs}ms`), { code: "llm_timeout" })), timeoutMs)
    ),
  ]);

  // Special handling for image generation
  if (task === "image_generation") {
    if (provider !== "openai") {
      throw pluginError.validation("Image generation currently only supported with OpenAI provider", { code: "invalid_provider" });
    }

    try {
      const result = await withLLMTimeout(
        withResilience(`llm-${provider}-image`, async () => {
          const response = await client.images.generate({
            model: model || "dall-e-3",
            prompt: prompt,
            n: options.n || 1,
            size: options.size || "1024x1024",
            quality: options.quality || "standard",
          });
          return {
            url: response.data?.[0]?.url,
            revised_prompt: response.data?.[0]?.revised_prompt,
          };
        }, {
          circuit: { failureThreshold: 3, resetTimeoutMs: 30000 },
          retry: { maxAttempts: 2, backoffMs: 1000 },
        })
      );

      const durationMs = Date.now() - startTime;
      const imageCost = estimateImageCostUsd(provider, model, options.size, options.quality);

      await recordRouteUsage(context, {
        provider,
        model,
        task,
        operationType: "image_generation",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: imageCost,
        durationMs,
        metadata: { image_count: options.n || 1, size: options.size || "1024x1024" },
      });

      auditEntry({
        operation: "image_generation",
        provider,
        model,
        task,
        promptLength: validation.promptLength,
        durationMs,
        actor: context.actor || "anonymous",
        workspaceId: context.workspaceId || null,
        projectId: context.projectId || null,
        correlationId,
        success: true,
        fallback: useFallback,
        retryCount,
      });

      return {
        content: result.url || result.revised_prompt || "Image generated",
        url: result.url,
        revised_prompt: result.revised_prompt,
        provider,
        model,
        task,
        usedFallback: useFallback,
        type: "image",
      };
    } catch (error) {
      auditEntry({
        operation: "image_generation",
        provider,
        model,
        task,
        promptLength: validation.promptLength,
        durationMs: Date.now() - startTime,
        actor: context.actor || "anonymous",
        workspaceId: context.workspaceId || null,
        projectId: context.projectId || null,
        correlationId,
        success: false,
        error: error.message,
        fallback: useFallback,
      });
      throw error;
    }
  }

  // Call LLM with resilience (for chat/text tasks)
  try {
    const llmResponse = await withLLMTimeout(
      withResilience(`llm-${provider}`, async () => {
        const response = await client.chat.completions.create({
          model: model,
          messages: [
            { role: "system", content: getSystemPrompt(task) },
            { role: "user", content: prompt },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: Math.min(options.maxTokens ?? 4096, MAX_OUTPUT_TOKENS),
        });
        return response;
      }, {
        circuit: { failureThreshold: 3, resetTimeoutMs: 30000 },
        retry: { maxAttempts: 2, backoffMs: 1000 },
      })
    );

    const result = llmResponse.choices?.[0]?.message?.content;
    const usage = normalizeUsageFromResponse(llmResponse, provider);
    const durationMs = Date.now() - startTime;
    const cost = computeCostUsd(model, usage.promptTokens, usage.completionTokens);

    await recordRouteUsage(context, {
      provider,
      model,
      task,
      operationType: "chat_completion",
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      estimatedCostUsd: cost,
      durationMs,
      metadata: { used_fallback: useFallback, retry_count: retryCount, route_correlation_id: correlationId },
    });

    auditEntry({
      operation: "route",
      provider,
      model,
      task,
      promptLength: validation.promptLength,
      responseLength: result?.length || 0,
      durationMs,
      actor: context.actor || "anonymous",
      workspaceId: context.workspaceId || null,
      projectId: context.projectId || null,
      correlationId,
      success: true,
      fallback: useFallback,
      retryCount,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
    });

    return {
      content: result,
      provider,
      model,
      task,
      usedFallback: useFallback,
      usage: { ...usage, estimatedCostUsd: cost },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // If primary fails and fallback exists, try fallback (skip on targetProvider override)
    if (!useFallback && !options.targetProvider && rule.fallback) {
      console.log(`[llm-router] Provider ${provider} failed: ${error.message}, trying fallback...`);
      retryCount++;
      auditEntry({
        operation: "route",
        provider,
        model,
        task,
        promptLength: validation.promptLength,
        durationMs,
        actor: context.actor || "anonymous",
        workspaceId: context.workspaceId || null,
        projectId: context.projectId || null,
        correlationId,
        success: false,
        error: error.message,
        fallback: useFallback,
        retryCount,
      });
      return routeTask(task, prompt, { ...options, useFallback: true }, context);
    }

    // No fallback available, log and re-throw
    auditEntry({
      operation: "route",
      provider,
      model,
      task,
      promptLength: validation.promptLength,
      durationMs,
      actor: context.actor || "anonymous",
      workspaceId: context.workspaceId || null,
      projectId: context.projectId || null,
      correlationId,
      success: false,
      error: error.message,
      fallback: useFallback,
      retryCount,
    });
    throw error;
  }
}

/**
 * Get system prompt for task type
 */
function getSystemPrompt(task) {
  const prompts = {
    backend_api: "You are an expert backend developer. Write clean, efficient, well-documented code following best practices. Include error handling and type safety.",
    frontend_component: "You are an expert frontend developer specializing in React and modern CSS. Write clean, accessible, responsive components with TypeScript.",
    code_review: "You are a senior code reviewer. Focus on bugs, security issues, performance, and best practices. Be specific and constructive.",
    debugging: "You are an expert debugger. Analyze the problem systematically and provide clear, actionable solutions.",
    refactoring: "You are a refactoring expert. Improve code quality, maintainability, and performance while preserving functionality.",
    documentation: "You are a technical writer. Write clear, concise documentation with examples.",
    testing: "You are a testing expert. Write comprehensive tests covering edge cases and happy paths.",
    complex_reasoning: "You are an expert systems architect. Think deeply about trade-offs, scalability, and maintainability.",
    multilingual: "You are a helpful assistant fluent in multiple languages. Adapt to the user's language naturally.",
    general: "You are a helpful AI assistant. Be concise and accurate.",
  };

  return prompts[task] || prompts.general;
}

/**
 * Compare responses from multiple LLMs
 */
export async function compareLLMs(task, prompt, providers = ["openai", "anthropic"]) {
  const results = await Promise.allSettled(
    providers.map(async (provider) => {
      if (!isProviderConfigured(provider)) {
        return { provider, error: "API key not configured" };
      }

      const startTime = Date.now();
      const result = await routeTask(task, prompt, { targetProvider: provider });
      const duration = Date.now() - startTime;

      return {
        provider,
        model: result.model,
        content: result.content,
        duration,
      };
    })
  );

  return results.map(r =>
    r.status === "fulfilled" ? r.value : { error: r.reason.message }
  );
}

/**
 * List available models
 */
export function listModels() {
  const available = [];

  for (const key of Object.keys(PROVIDERS)) {
    const config = getRuntimeProviderConfig(key);
    const available_flag = isProviderConfigured(key);
    const entry = {
      provider: key,
      name: config.name,
      models: config.models,
      strengths: config.strengths,
      costTier: config.costTier,
      available: available_flag,
    };

    if (key === "vllm") {
      entry.baseUrl = config.baseUrl || null;
      entry.configuredModels = available_flag ? config.models : [];
      entry.setupHint = available_flag
        ? `Connected to ${config.baseUrl}`
        : "Set VLLM_BASE_URL=http://your-server:8000/v1 to enable";
    }

    if (key === "ollama") {
      entry.baseUrl = config.baseUrl;
    }

    available.push(entry);
  }

  return available;
}

/** Flat list of model ids from all configured providers */
export function listConfiguredModelIds() {
  const ids = [];
  for (const entry of listModels()) {
    if (!entry.available) continue;
    for (const m of entry.models || []) {
      if (m && !ids.includes(m)) ids.push(m);
    }
  }
  const chatModel = getChatDefaultModel();
  if (chatModel && !ids.includes(chatModel)) ids.unshift(chatModel);
  const routerModel = getRouterDefaultModel();
  if (routerModel && !ids.includes(routerModel)) ids.push(routerModel);
  return ids;
}

/**
 * Estimate cost for a task
 */
export function estimateCost(task, promptTokens = 1000, responseTokens = 2000) {
  // Pricing per 1M tokens (USD) — updated 2026
  const pricing = {
    "gpt-4.1":          { input: 2.0,  output: 8.0  },
    "gpt-4.1-mini":     { input: 0.4,  output: 1.6  },
    "gpt-4o":           { input: 2.5,  output: 10.0 },
    "gpt-4o-mini":      { input: 0.15, output: 0.6  },
    "o3-mini":          { input: 1.1,  output: 4.4  },
    "claude-opus-4-5":  { input: 15.0, output: 75.0 },
    "claude-sonnet-4-5":{ input: 3.0,  output: 15.0 },
    "claude-haiku-4-5": { input: 0.8,  output: 4.0  },
    "gemini-2.0-flash": { input: 0.1,  output: 0.4  },
    "gemini-2.0-pro-exp":{ input: 1.25, output: 5.0 },
    "gemini-1.5-pro":   { input: 1.25, output: 5.0  },
    "gemini-1.5-flash": { input: 0.075,output: 0.3  },
    "mistral-large-latest": { input: 2.0, output: 6.0 },
    "mistral-small-latest": { input: 0.2, output: 0.6 },
  };

  const rule = ROUTING_RULES.find(r => r.task === task);
  if (!rule) return null;

  const model = rule.primary.model;
  const price = pricing[model];
  if (!price) return null;

  const inputCost = (promptTokens / 1000000) * price.input;
  const outputCost = (responseTokens / 1000000) * price.output;

  return {
    model,
    provider: rule.primary.provider,
    estimatedCost: inputCost + outputCost,
    currency: "USD",
    inputTokens: promptTokens,
    outputTokens: responseTokens,
  };
}

// MCP Tools
export const tools = [
  {
    name: "llm_route",
    description: "Route prompts to the best LLM provider based on task type",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          enum: ROUTING_RULES.map(r => r.task),
          description: "Type of task to route (coding, analysis, documentation, fast, local, etc.)",
        },
        prompt: {
          type: "string",
          description: "The prompt to send to the LLM",
        },
        explanation: {
          type: "string",
          description: "Explain why you selected this task type and provider",
        },
        temperature: {
          type: "number",
          description: "Temperature (0-1)",
          default: 0.7,
        },
        maxTokens: {
          type: "number",
          description: "Maximum tokens to generate",
          default: 4096,
        },
      },
      required: ["task", "prompt", "explanation"],
    },
    handler: async ({ task, prompt, explanation, temperature, maxTokens }, ctx) => {
      try {
        const result = await routeTask(task, prompt, { temperature, maxTokens }, {
          ...ctx,
          toolName: "llm_route",
          source: ctx?.source || "mcp_tool",
          channel: ctx?.channel || "cursor",
        });
        return {
          ok: true,
          data: {
            ...result,
            explanation,
            routing_reason: `Selected ${result.provider} (${result.model}) for ${task} task`,
          },
        };
      } catch (error) {
        return {
          ok: false,
          error: {
            code: "llm_error",
            message: error.message,
          },
        };
      }
    },
  },
  {
    name: "llm_route_backend",
    description: "Route backend API development tasks to optimal LLM provider",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The backend development prompt to send to the LLM",
        },
        explanation: {
          type: "string",
          description: "Explain why you need backend API development",
        },
        temperature: {
          type: "number",
          description: "Temperature (0-1)",
          default: 0.7,
        },
        maxTokens: {
          type: "number",
          description: "Maximum tokens to generate",
          default: 4096,
        },
      },
      required: ["prompt", "explanation"],
    },
    handler: async ({ prompt, explanation, temperature, maxTokens }, ctx) => {
      try {
        const result = await routeTask("backend_api", prompt, { temperature, maxTokens }, {
          ...ctx,
          toolName: "llm_route_backend",
          source: ctx?.source || "mcp_tool",
        });
        return {
          ok: true,
          data: {
            ...result,
            explanation,
            routing_reason: `Selected ${result.provider} (${result.model}) for backend API task`,
          },
        };
      } catch (error) {
        return {
          ok: false,
          error: {
            code: "llm_error",
            message: error.message,
          },
        };
      }
    },
  },
  {
    name: "llm_route_frontend",
    description: "Route frontend component tasks to optimal LLM provider",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The frontend component prompt to send to the LLM",
        },
        explanation: {
          type: "string",
          description: "Explain why you need frontend component development",
        },
        temperature: {
          type: "number",
          description: "Temperature (0-1)",
          default: 0.7,
        },
        maxTokens: {
          type: "number",
          description: "Maximum tokens to generate",
          default: 4096,
        },
      },
      required: ["prompt", "explanation"],
    },
    handler: async ({ prompt, explanation, temperature, maxTokens }, ctx) => {
      try {
        const result = await routeTask("frontend_component", prompt, { temperature, maxTokens }, {
          ...ctx,
          toolName: "llm_route_frontend",
          source: ctx?.source || "mcp_tool",
        });
        return {
          ok: true,
          data: {
            ...result,
            explanation,
            routing_reason: `Selected ${result.provider} (${result.model}) for frontend component task`,
          },
        };
      } catch (error) {
        return {
          ok: false,
          error: {
            code: "llm_error",
            message: error.message,
          },
        };
      }
    },
  },
  {
    name: "llm_compare",
    description: "Compare responses from multiple LLM providers",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          enum: ROUTING_RULES.map(r => r.task),
          description: "Type of task",
        },
        prompt: {
          type: "string",
          description: "The prompt to send",
        },
        explanation: {
          type: "string",
          description: "Explain why you want to compare these providers",
        },
        providers: {
          type: "array",
          items: { type: "string" },
          description: "Providers to compare (e.g., ['openai', 'anthropic'])",
          default: ["openai", "anthropic"],
        },
      },
      required: ["task", "prompt", "explanation"],
    },
    handler: async ({ task, prompt, explanation, providers }) => {
      try {
        const results = await compareLLMs(task, prompt, providers);
        return {
          ok: true,
          data: {
            comparison: results,
            explanation,
          },
        };
      } catch (error) {
        return {
          ok: false,
          error: {
            code: "comparison_error",
            message: error.message,
          },
        };
      }
    },
  },
  {
    name: "llm_list_models",
    description: "List available LLM models and providers",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: () => {
      return {
        ok: true,
        data: listModels(),
      };
    },
  },
  {
    name: "llm_estimate_cost",
    description: "Estimate cost for a task before running it",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          enum: ROUTING_RULES.map(r => r.task),
          description: "Task type",
        },
        explanation: {
          type: "string",
          description: "Explain why you need this cost estimate",
        },
        promptTokens: {
          type: "number",
          description: "Estimated input tokens",
          default: 1000,
        },
        responseTokens: {
          type: "number",
          description: "Estimated output tokens",
          default: 2000,
        },
      },
      required: ["task", "explanation"],
    },
    handler: ({ task, explanation, promptTokens, responseTokens }) => {
      const estimate = estimateCost(task, promptTokens, responseTokens);
      return {
        ok: true,
        data: {
          ...estimate,
          explanation,
        },
      };
    },
  },
  {
    name: "llm_route_custom",
    description: "Send a prompt to a self-hosted vLLM or any OpenAI-compatible endpoint configured via VLLM_BASE_URL",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The prompt to send to the custom model",
        },
        model: {
          type: "string",
          description: "Model name to use (must be deployed on the vLLM server, e.g. 'mistral-7b-instruct')",
        },
        explanation: {
          type: "string",
          description: "Explain why you are routing to the custom endpoint",
        },
        temperature: {
          type: "number",
          description: "Temperature (0-1)",
          default: 0.7,
        },
        maxTokens: {
          type: "number",
          description: "Maximum tokens to generate",
          default: 4096,
        },
      },
      required: ["prompt", "explanation"],
    },
    handler: async ({ prompt, model, explanation, temperature, maxTokens }, ctx) => {
      const vllmConfig = PROVIDERS.vllm;
      if (!vllmConfig.baseUrl) {
        return {
          ok: false,
          error: {
            code: "provider_not_configured",
            message: "VLLM_BASE_URL is not set. Configure it to use the custom endpoint.",
          },
        };
      }
      try {
        const targetModel = model || vllmConfig.models[0];
        const result = await routeTask("custom", prompt, {
          targetProvider: "vllm",
          temperature,
          maxTokens,
        }, {
          ...ctx,
          toolName: "llm_route_custom",
          source: ctx?.source || "mcp_tool",
        });
        return {
          ok: true,
          data: {
            ...result,
            model: targetModel,
            endpoint: vllmConfig.baseUrl,
            explanation,
          },
        };
      } catch (error) {
        return {
          ok: false,
          error: { code: "vllm_error", message: error.message },
        };
      }
    },
  },
  {
    name: "llm_list_providers",
    description: "List all configured LLM providers including vLLM/custom endpoint status",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: () => ({
      ok: true,
      data: listModels(),
    }),
  },
];

// REST API Endpoints — documented format (used by OpenAPI generator)
export const endpoints = [
  { method: "GET",  path: "/llm/health",                   description: "Plugin health",                                               scope: "read"  },
  { method: "POST", path: "/llm/route",                    description: "Route a prompt to the best LLM provider",                       scope: "write" },
  { method: "POST", path: "/llm/compare",                  description: "Compare responses from multiple LLM providers",                  scope: "write" },
  { method: "GET",  path: "/llm/models",                   description: "List available LLM models and their availability",               scope: "read"  },
  { method: "GET",  path: "/llm/providers",                description: "List all providers with config details (incl. vLLM status)",     scope: "read"  },
  { method: "POST", path: "/llm/estimate-cost",            description: "Estimate cost for a task before running it",                     scope: "read"  },
  { method: "GET",  path: "/llm/audit",                    description: "View recent LLM operation audit log",                            scope: "read"  },
  { method: "GET",  path: "/llm/routing-rules",            description: "List all task routing rules",                                    scope: "read"  },
  { method: "POST", path: "/llm/providers/vllm/test",      description: "Test connectivity to configured vLLM/custom endpoint",           scope: "write" },
  { method: "GET",  path: "/llm/providers/vllm/models",    description: "Fetch loaded models from the vLLM server",                       scope: "read"  },
];

// Plugin registration — mounts all routes
export function register(app) {
  const router = Router();
  mountPluginHealth(router, { name, version });
  router.use(requireScopeByMethod());

  /**
   * POST /llm/route
   * Route a prompt to the optimal LLM provider based on task type.
   * Body: { task, prompt, options?: { temperature, maxTokens, timeoutMs } }
   */
  router.post("/route", async (req, res) => {
    const { task, prompt, options } = req.body;
    if (!task || !prompt) {
      return res.status(400).json({ ok: false, error: { code: "missing_fields", message: "task and prompt are required" } });
    }
    try {
      const context = extractContext(req);
      const result = await routeTask(task, prompt, options || {}, context);
      res.json({ ok: true, data: result });
    } catch (error) {
      const statusCode =
        error.code === "prompt_limit_exceeded" ? 400 :
        error.code === "provider_unavailable"  ? 503 :
        error.code === "llm_timeout"           ? 504 : 500;
      res.status(statusCode).json({ ok: false, error: { code: error.code || "llm_error", message: error.message } });
    }
  });

  /**
   * POST /llm/compare
   * Compare responses from multiple providers for the same prompt.
   * Body: { task, prompt, providers?: string[] }
   */
  router.post("/compare", async (req, res) => {
    const { task, prompt, providers } = req.body;
    if (!task || !prompt) {
      return res.status(400).json({ ok: false, error: { code: "missing_fields", message: "task and prompt are required" } });
    }
    try {
      const results = await compareLLMs(task, prompt, providers);
      res.json({ ok: true, data: results });
    } catch (error) {
      res.status(500).json({ ok: false, error: { code: error.code || "compare_error", message: error.message } });
    }
  });

  /**
   * GET /llm/models
   * List all providers and which models are available (based on configured API keys).
   */
  router.get("/models", (req, res) => {
    res.json({ ok: true, data: listModels() });
  });

  /**
   * POST /llm/estimate-cost
   * Estimate cost for a task given approximate token counts.
   * Body: { task, promptTokens?, responseTokens? }
   */
  router.post("/estimate-cost", (req, res) => {
    const { task, promptTokens, responseTokens } = req.body;
    if (!task) {
      return res.status(400).json({ ok: false, error: { code: "missing_task", message: "task is required" } });
    }
    const estimate = estimateCost(task, promptTokens, responseTokens);
    if (!estimate) {
      return res.status(404).json({ ok: false, error: { code: "unknown_task", message: `No routing rule for task: ${task}` } });
    }
    res.json({ ok: true, data: estimate });
  });

  /**
   * GET /llm/audit
   * View recent LLM operation audit entries.
   * Query: ?limit=50
   */
  router.get("/audit", async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const entries = await getAuditLogEntries(limit);
    res.json({ ok: true, data: { count: entries.length, entries } });
  });

  /**
   * GET /llm/routing-rules
   * List all task types and their routing configuration.
   */
  router.get("/routing-rules", (req, res) => {
    res.json({
      ok: true,
      data: ROUTING_RULES.map(r => ({
        task: r.task,
        description: r.description,
        primary: r.primary,
        fallback: r.fallback || null,
        priority: r.priority,
      })),
    });
  });

  /**
   * GET /llm/providers
   * List all providers with availability and configuration details.
   * Includes vLLM/custom endpoint status.
   */
  router.get("/providers", (req, res) => {
    res.json({ ok: true, data: listModels() });
  });

  /**
   * POST /llm/providers/vllm/test
   * Test connectivity to the configured vLLM endpoint.
   * Sends a minimal ping prompt and returns latency.
   */
  router.post("/providers/vllm/test", async (req, res) => {
    const vllmConfig = PROVIDERS.vllm;
    if (!vllmConfig.baseUrl) {
      return res.status(400).json({
        ok: false,
        error: { code: "not_configured", message: "VLLM_BASE_URL is not set" },
      });
    }
    const startTime = Date.now();
    try {
      const result = await routeTask("custom", req.body?.prompt || "Say hello in one word.", {
        targetProvider: "vllm",
        maxTokens: 10,
        timeoutMs: 10000,
      });
      res.json({
        ok: true,
        data: {
          endpoint: vllmConfig.baseUrl,
          model: result.model,
          latencyMs: Date.now() - startTime,
          response: result.content,
        },
      });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error: { code: "vllm_unreachable", message: error.message, endpoint: vllmConfig.baseUrl },
      });
    }
  });

  /**
   * POST /llm/providers/vllm/models
   * Fetch the list of models loaded on the vLLM server (via /v1/models endpoint).
   */
  router.get("/providers/vllm/models", async (req, res) => {
    const vllmConfig = PROVIDERS.vllm;
    if (!vllmConfig.baseUrl) {
      return res.status(400).json({
        ok: false,
        error: { code: "not_configured", message: "VLLM_BASE_URL is not set" },
      });
    }
    try {
      const response = await fetch(`${vllmConfig.baseUrl}/models`, {
        headers: {
          "Authorization": `Bearer ${vllmConfig.apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`vLLM server returned ${response.status}`);
      }
      const data = await response.json();
      const models = (data.data || []).map(m => ({ id: m.id, object: m.object }));
      res.json({ ok: true, data: { endpoint: vllmConfig.baseUrl, models } });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error: { code: "vllm_unreachable", message: error.message },
      });
    }
  });

  app.use("/llm", router);

  const available = listModels().filter(m => m.available).map(m => m.provider);
  console.log(`[llm-router] Registered — available providers: ${available.join(", ") || "none (no API keys configured)"}`);
}
