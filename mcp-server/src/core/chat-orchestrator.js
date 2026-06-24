/**
 * Shared chat orchestrator — SSE (ui-chat) and non-SSE (Telegram) entry points
 */

import OpenAI from "openai";
import { listTools, callTool, approveTool } from "./tool-registry.js";
import { ToolTags } from "./tool-registry.js";
import { buildCompactContext } from "../plugins/brain/brain.context.js";
import { recordUsageEvent } from "./usage/usage-ledger.service.js";
import { computeCostUsd } from "./usage/usage-pricing.js";
import { mergeUsageTotals, normalizeUsageFromResponse, usageContextFromRequest } from "./usage/usage-context.js";
import { buildSystemPrompt, buildToolCatalogSummary } from "./chat/chat-system-prompt.js";
import {
  getLlmKeyMode,
  getProviderApiKey,
  getUnifiedApiKey,
  getChatProviderPreference,
  getResolvedChatProvider,
  getChatDefaultModel,
  isProviderKeyConfigured,
} from "./llm-config.js";
import { getEnvValue } from "./settings/effective-config.js";
import {
  recordApprovalPending,
  recordApprovalResolved,
  recordLlmStep,
  recordToolStep,
} from "./agent-runs/run-orchestrator.js";
import { withToolRetry } from "./agent-runs/tool-retry.js";

export const MAX_TOOL_ITERATIONS = 8;
export const APPROVAL_TIMEOUT_MS = 120_000;

/** @type {Map<string, { resolve: Function, toolName: string, args: object, context: object }>} */
const approvalWaiters = new Map();

export function getOpenAiClient() {
  const pref = getChatProviderPreference();
  const resolved = getResolvedChatProvider();

  if (resolved === "openai" || (pref === "auto" && isProviderKeyConfigured("openai"))) {
    const key = getLlmKeyMode() === "unified" ? getUnifiedApiKey() : getProviderApiKey("openai");
    if (key) return new OpenAI({ apiKey: key });
  }

  if (resolved === "vllm" || (pref === "auto" && isProviderKeyConfigured("vllm"))) {
    const vllmUrl = getEnvValue("VLLM_BASE_URL")?.trim();
    if (vllmUrl) {
      return new OpenAI({
        apiKey: getProviderApiKey("vllm") || "not-needed",
        baseURL: vllmUrl,
      });
    }
  }

  return null;
}

export function getChatProvider() {
  return getResolvedChatProvider();
}

export function getOllamaBaseUrl() {
  return (getEnvValue("OLLAMA_BASE_URL") || "http://127.0.0.1:11434").replace(/\/$/, "");
}

export function getDefaultModel() {
  return getChatDefaultModel();
}

export async function checkProviderAvailable() {
  const resolved = getResolvedChatProvider();
  if (resolved === "openai" || resolved === "vllm") {
    if (getOpenAiClient()) {
      return { available: true, provider: resolved };
    }
  }
  if (resolved === "ollama") {
    try {
      const res = await fetch(`${getOllamaBaseUrl()}/api/tags`, { signal: AbortSignal.timeout(3000) });
      return { available: res.ok, provider: "ollama" };
    } catch {
      return {
        available: false,
        provider: "ollama",
        hint: "Ollama çalışmıyor. Ollama başlatın veya Ayarlar → LLM bölümünden OpenAI/vLLM yapılandırın.",
      };
    }
  }
  return {
    available: false,
    provider: "none",
    hint: "LLM yapılandırılmamış. Ayarlar → LLM bölümünden anahtar ve atama yapın.",
  };
}

const MAX_CHAT_TOOLS = 128;

const CHAT_TOOL_PRIORITY = new Set([
  "policy_list_rules",
  "policy_evaluate",
  "policy_list_approvals",
  "llm_list_models",
  "llm_list_providers",
  "llm_route",
  "observability_health",
  "observability_metrics",
  "brain_recall",
  "brain_remember",
  "brain_get_context",
  "brain_get_stats",
  "prompt_list",
  "git_status",
]);

export function selectChatTools(allTools, { allowWriteTools = true, pluginFilter = null } = {}) {
  let tools = allTools;
  if (pluginFilter) {
    const needle = String(pluginFilter).toLowerCase();
    tools = tools.filter((t) => (t.plugin || "").toLowerCase() === needle);
  }
  if (!allowWriteTools) {
    tools = allTools.filter((t) => !isWriteToolDef(t));
  }
  const priority = [];
  const rest = [];
  for (const tool of tools) {
    if (CHAT_TOOL_PRIORITY.has(tool.name)) priority.push(tool);
    else rest.push(tool);
  }
  const sortedRest = rest.sort((a, b) => {
    const score = (t) => {
      const tags = t.tags || [];
      if (tags.includes(ToolTags.READ_ONLY) || tags.includes("read_only")) return 0;
      if (tags.includes("write") && !tags.includes("destructive")) return 1;
      return 2;
    };
    return score(a) - score(b) || a.name.localeCompare(b.name);
  });
  return [...priority, ...sortedRest].slice(0, MAX_CHAT_TOOLS);
}

export function isWriteToolDef(tool) {
  const tags = tool?.tags || [];
  return (
    tags.includes(ToolTags.WRITE) ||
    tags.includes(ToolTags.DESTRUCTIVE) ||
    tags.includes("write") ||
    tags.includes("destructive")
  );
}

export function isWriteToolName(name) {
  const tool = listTools().find((t) => t.name === name);
  return tool ? isWriteToolDef(tool) : false;
}

export function buildOpenAiTools(options = {}) {
  return selectChatTools(listTools(), options).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema || { type: "object", properties: {} },
    },
  }));
}

export { buildSystemPrompt, buildToolCatalogSummary } from "./chat/chat-system-prompt.js";

async function waitForApproval(approvalId, toolName, args, context) {
  return new Promise((resolve) => {
    approvalWaiters.set(approvalId, { resolve, toolName, args, context });
    setTimeout(() => {
      if (!approvalWaiters.has(approvalId)) return;
      approvalWaiters.delete(approvalId);
      resolve({
        ok: false,
        error: { code: "approval_timeout", message: "Onay zaman aşımına uğradı (120s)" },
      });
    }, APPROVAL_TIMEOUT_MS);
  });
}

export function getApprovalWaiter(approvalId) {
  return approvalWaiters.get(approvalId);
}

export function deleteApprovalWaiter(approvalId) {
  approvalWaiters.delete(approvalId);
}

async function runToolWithApproval(name, args, context, handlers = {}) {
  const { allowWriteTools = true, onToolCall = () => {}, onApproval = () => {} } = handlers;

  if (!allowWriteTools && isWriteToolName(name)) {
    const blocked = {
      ok: false,
      error: {
        code: "write_tool_blocked",
        message: `Write tool "${name}" is not allowed in this channel`,
      },
    };
    onToolCall({ phase: "start", name, arguments: args });
    onToolCall({ phase: "end", name, result: blocked });
    return blocked;
  }

  onToolCall({ phase: "start", name, arguments: args });
  const toolStart = Date.now();
  const toolContext = {
    ...context,
    parentCorrelationId: context.parentCorrelationId || context.requestId,
    toolName: name,
    runId: context.runId,
  };

  let result = await withToolRetry(
    async (attempt) => {
      const r = await callTool(name, args, { ...toolContext, retryAttempt: attempt });
      if (r?.status === "approval_required" && r.approval?.id) return r;
      return r;
    },
    { maxAttempts: 3 }
  );

  if (result?.status === "approval_required" && result.approval?.id) {
    if (!allowWriteTools) {
      const rejected = {
        ok: false,
        error: { code: "approval_required_blocked", message: "Tool approval not available in this channel" },
      };
      onToolCall({ phase: "end", name, result: rejected });
      if (context.runId) {
        void recordToolStep(context.runId, {
          toolName: name,
          input: args,
          output: rejected,
          durationMs: Date.now() - toolStart,
          phase: "end",
        });
      }
      return rejected;
    }
    if (context.runId) {
      void recordApprovalPending(context.runId, {
        approvalId: result.approval.id,
        toolName: name,
        args,
      });
    }
    onApproval({
      approvalId: result.approval.id,
      tool: name,
      arguments: args,
      message: result.message,
      runId: context.runId,
    });
    result = await waitForApproval(result.approval.id, name, args, context);
  }

  onToolCall({ phase: "end", name, result });
  if (context.runId) {
    void recordToolStep(context.runId, {
      toolName: name,
      input: args,
      output: result,
      durationMs: Date.now() - toolStart,
      phase: "end",
    });
  }
  return result;
}

async function recordChatUsage(context, { model, provider, usage, iteration, durationMs }) {
  const u = usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const cost = computeCostUsd(model, u.promptTokens, u.completionTokens);
  const base = usageContextFromRequest(context, {
    source: context.source || "chat_ui",
    toolName: "chat_completion",
    operationType: "chat_completion",
  });
  await recordUsageEvent({
    ...base,
    runId: context.runId || null,
    provider,
    model,
    promptTokens: u.promptTokens,
    completionTokens: u.completionTokens,
    totalTokens: u.totalTokens,
    estimatedCostUsd: cost,
    durationMs,
    metadata: { iteration, stream: true },
  });
  if (context.runId) {
    void recordLlmStep(context.runId, {
      model,
      provider,
      usage: u,
      durationMs,
      iteration,
    });
  }
  return { ...u, estimatedCostUsd: cost || 0 };
}

async function chatWithOpenAi({ messages, model, tools, context, handlers }) {
  const client = getOpenAiClient();
  if (!client) throw new Error("OPENAI_API_KEY not configured");

  const resolvedModel = model || getDefaultModel();
  const { onDelta = () => {}, ...toolHandlers } = handlers;
  let currentMessages = [...messages];
  let iterations = 0;
  const toolCallsLog = [];
  let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 };

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    const iterStart = Date.now();
    const stream = await client.chat.completions.create({
      model: resolvedModel,
      messages: currentMessages,
      tools: tools.length ? tools : undefined,
      stream: true,
      stream_options: { include_usage: true },
      temperature: 0.7,
    });

    let assistantContent = "";
    const toolCallsByIndex = new Map();
    let iterUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    for await (const chunk of stream) {
      if (chunk.usage) {
        iterUsage = normalizeUsageFromResponse(chunk, "openai");
      }
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        assistantContent += delta.content;
        onDelta(delta.content);
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCallsByIndex.has(idx)) {
            toolCallsByIndex.set(idx, { id: tc.id, name: tc.function?.name || "", arguments: "" });
          }
          const entry = toolCallsByIndex.get(idx);
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name = tc.function.name;
          if (tc.function?.arguments) entry.arguments += tc.function.arguments;
        }
      }
    }

    const recorded = await recordChatUsage(context, {
      model: resolvedModel,
      provider: getChatProvider(),
      usage: iterUsage,
      iteration: iterations,
      durationMs: Date.now() - iterStart,
    });
    totalUsage = mergeUsageTotals(totalUsage, recorded);

    const toolCalls = [...toolCallsByIndex.values()].filter((t) => t.name);
    if (!toolCalls.length) {
      return { text: assistantContent, iterations, toolCalls: toolCallsLog, usage: totalUsage };
    }

    currentMessages.push({
      role: "assistant",
      content: assistantContent || null,
      tool_calls: toolCalls.map((t) => ({
        id: t.id,
        type: "function",
        function: { name: t.name, arguments: t.arguments },
      })),
    });

    for (const tc of toolCalls) {
      let args = {};
      try {
        args = tc.arguments ? JSON.parse(tc.arguments) : {};
      } catch {
        args = {};
      }

      toolCallsLog.push({ name: tc.name, arguments: args });
      const result = await runToolWithApproval(tc.name, args, context, toolHandlers);
      currentMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result.ok ? result.data : result.error || result),
      });
    }
  }

  return { text: "", iterations, maxIterations: true, toolCalls: toolCallsLog, usage: totalUsage };
}

async function chatWithOllama({ messages, model, tools, context, handlers }) {
  const baseUrl = getOllamaBaseUrl();
  const resolvedModel = model || getDefaultModel();
  const { allowWriteTools = true, onDelta = () => {}, onToolCall, onApproval } = handlers;
  const ollamaTools = tools?.length ? tools : buildOpenAiTools({ allowWriteTools });

  let currentMessages = [...messages];
  let iterations = 0;
  const toolCallsLog = [];
  let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 };

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    const iterStart = Date.now();
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: resolvedModel,
        messages: currentMessages,
        tools: ollamaTools.length ? ollamaTools : undefined,
        stream: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`);
    }

    let msg = { role: "assistant", content: "", tool_calls: [] };
    let iterUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        let chunk;
        try {
          chunk = JSON.parse(line);
        } catch {
          continue;
        }
        const delta = chunk.message;
        if (!delta) continue;

        if (delta.content) {
          msg.content += delta.content;
          onDelta(delta.content);
        }
        if (delta.tool_calls?.length) {
          for (const tc of delta.tool_calls) {
            const idx = tc.function?.index ?? 0;
            if (!msg.tool_calls[idx]) {
              msg.tool_calls[idx] = {
                function: { name: tc.function?.name || "", arguments: "" },
              };
            }
            if (tc.function?.name) msg.tool_calls[idx].function.name = tc.function.name;
            if (tc.function?.arguments) msg.tool_calls[idx].function.arguments += tc.function.arguments;
          }
        }
        if (chunk.done) {
          iterUsage = normalizeUsageFromResponse(chunk, "ollama");
          break;
        }
      }
    }

    const recorded = await recordChatUsage(context, {
      model: resolvedModel,
      provider: "ollama",
      usage: iterUsage,
      iteration: iterations,
      durationMs: Date.now() - iterStart,
    });
    totalUsage = mergeUsageTotals(totalUsage, recorded);

    msg.tool_calls = (msg.tool_calls || []).filter((t) => t?.function?.name);
    if (!msg.tool_calls.length) {
      return { text: msg.content || "", iterations, toolCalls: toolCallsLog, usage: totalUsage };
    }

    currentMessages.push(msg);

    for (const tc of msg.tool_calls) {
      const name = tc.function.name;
      let args = {};
      try {
        args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        args = {};
      }
      toolCallsLog.push({ name, arguments: args });
      const result = await runToolWithApproval(name, args, context, {
        allowWriteTools,
        onToolCall,
        onApproval,
      });
      currentMessages.push({
        role: "tool",
        content: JSON.stringify(result.ok ? result.data : result.error || result),
      });
    }
  }

  return { text: "", iterations, maxIterations: true, toolCalls: toolCallsLog, usage: totalUsage };
}

/**
 * Non-SSE chat turn for Telegram and other integrations.
 */
export async function runChatTurn({
  message,
  history = [],
  model,
  systemPrompt,
  includeBrainContext = true,
  projectId,
  context = {},
  allowWriteTools = false,
  onToolCall,
}) {
  if (!message || typeof message !== "string") {
    throw new Error("message string required");
  }

  const chatContext = {
    method: context.method || "CHAT_TURN",
    user: context.user || context.actor || "agent",
    scopes: context.scopes || ["read"],
    projectId: projectId || context.projectId,
    projectEnv: context.projectEnv,
    requestId: context.requestId,
    channel: context.channel || "telegram",
    source: context.source || "telegram",
    conversationId: context.conversationId,
    runId: context.runId || null,
  };

  let brainBlock = "";
  if (includeBrainContext) {
    try {
      brainBlock = await buildCompactContext({ task: message, projectId: chatContext.projectId });
    } catch {
      brainBlock = "";
    }
  }

  const systemContent = buildSystemPrompt(
    [systemPrompt, brainBlock].filter(Boolean).join("\n\n"),
    { toolCatalog: buildToolCatalogSummary(listTools()) }
  );

  const messages = [
    { role: "system", content: systemContent },
    ...history.filter((m) => m?.role && m?.content).slice(-20),
    { role: "user", content: message },
  ];

  const useOpenAi = !!getOpenAiClient();
  if (!useOpenAi) {
    const status = await checkProviderAvailable();
    if (!status.available) {
      throw new Error(status.hint || "LLM provider unavailable");
    }
  }

  const tools = buildOpenAiTools({ allowWriteTools });
  const handlers = {
    allowWriteTools,
    onDelta: () => {},
    onToolCall: onToolCall || (() => {}),
    onApproval: () => {},
  };

  const result = useOpenAi
    ? await chatWithOpenAi({ messages, model, tools, context: chatContext, handlers })
    : await chatWithOllama({ messages, model, context: chatContext, handlers });

  return {
    ...result,
    provider: useOpenAi ? getChatProvider() : "ollama",
    model: model || getDefaultModel(),
  };
}

export async function resolveChatApproval(approvalId, approved) {
  const waiter = approvalWaiters.get(approvalId);
  if (!waiter) return null;

  approvalWaiters.delete(approvalId);

  if (!approved) {
    const { getApprovalStore } = await import("./policy-hooks.js");
    getApprovalStore()?.updateApprovalStatus?.(approvalId, "rejected", "ui");
    if (waiter.context?.runId) {
      void recordApprovalResolved(waiter.context.runId, {
        approvalId,
        approved: false,
        toolName: waiter.toolName,
      });
    }
    waiter.resolve({
      ok: false,
      error: { code: "approval_rejected", message: "Kullanıcı tool çalıştırmayı reddetti" },
    });
    return { status: "rejected" };
  }

  const approveResult = await approveTool(approvalId, { user: "ui" });
  const toolResult = approveResult.ok ? approveResult.data?.result : approveResult;
  if (waiter.context?.runId) {
    void recordApprovalResolved(waiter.context.runId, {
      approvalId,
      approved: true,
      toolName: waiter.toolName,
    });
  }
  waiter.resolve(toolResult || approveResult);
  return { status: "approved", result: toolResult };
}

export { chatWithOpenAi, chatWithOllama, runToolWithApproval };
