/**
 * Web UI Chat — LLM + MCP tool loop with SSE streaming
 */

import OpenAI from "openai";
import { listTools, callTool, approveTool } from "./tool-registry.js";
import { listModels } from "../plugins/llm-router/index.js";
import { buildCompactContext } from "../plugins/brain/brain.context.js";
import { requireScope } from "./auth.js";

const MAX_TOOL_ITERATIONS = 8;
const DEFAULT_TASK = "general";
const APPROVAL_TIMEOUT_MS = 120_000;

/** @type {Map<string, { resolve: Function, toolName: string, args: object, context: object }>} */
const approvalWaiters = new Map();

function getOpenAiClient() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function getOllamaBaseUrl() {
  return (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
}

function getDefaultModel() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
  return process.env.OLLAMA_MODEL || "llama3.3";
}

async function checkProviderAvailable() {
  if (getOpenAiClient()) return { available: true, provider: "openai" };
  try {
    const res = await fetch(`${getOllamaBaseUrl()}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return { available: res.ok, provider: "ollama" };
  } catch {
    return {
      available: false,
      provider: "ollama",
      hint: "Ollama çalışmıyor. Ollama başlat veya OPENAI_API_KEY ayarla.",
    };
  }
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
  "brain_get_context",
  "brain_get_stats",
  "prompt_list",
  "git_status",
]);

function selectChatTools(allTools) {
  const priority = [];
  const rest = [];
  for (const tool of allTools) {
    if (CHAT_TOOL_PRIORITY.has(tool.name)) priority.push(tool);
    else rest.push(tool);
  }
  const sortedRest = rest.sort((a, b) => {
    const score = (t) => {
      const tags = t.tags || [];
      if (tags.includes("read_only")) return 0;
      if (tags.includes("write") && !tags.includes("destructive")) return 1;
      return 2;
    };
    return score(a) - score(b) || a.name.localeCompare(b.name);
  });
  return [...priority, ...sortedRest].slice(0, MAX_CHAT_TOOLS);
}

function buildOpenAiTools() {
  return selectChatTools(listTools()).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema || { type: "object", properties: {} },
    },
  }));
}

function buildSystemPrompt(extra = "") {
  const base =
    "You are mcp-hub assistant. You have access to MCP tools. Use tools when needed. Be concise. Respond in the user's language.";
  return extra ? `${base}\n\n${extra}` : base;
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function waitForApproval(approvalId, toolName, args, context) {
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

async function runToolWithApproval(name, args, context, onToolCall, onApproval) {
  onToolCall({ phase: "start", name, arguments: args });
  let result = await callTool(name, args, context);

  if (result?.status === "approval_required" && result.approval?.id) {
    onApproval({
      approvalId: result.approval.id,
      tool: name,
      arguments: args,
      message: result.message,
    });
    result = await waitForApproval(result.approval.id, name, args, context);
  }

  onToolCall({ phase: "end", name, result });
  return result;
}

async function chatWithOpenAi({ messages, model, tools, context, onDelta, onToolCall, onApproval }) {
  const client = getOpenAiClient();
  if (!client) throw new Error("OPENAI_API_KEY not configured");

  let currentMessages = [...messages];
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    const stream = await client.chat.completions.create({
      model: model || getDefaultModel(),
      messages: currentMessages,
      tools: tools.length ? tools : undefined,
      stream: true,
      temperature: 0.7,
    });

    let assistantContent = "";
    const toolCallsByIndex = new Map();

    for await (const chunk of stream) {
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

    const toolCalls = [...toolCallsByIndex.values()].filter((t) => t.name);
    if (!toolCalls.length) {
      return { content: assistantContent, iterations };
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

      const result = await runToolWithApproval(tc.name, args, context, onToolCall, onApproval);
      currentMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result.ok ? result.data : result.error || result),
      });
    }
  }

  return { content: "", iterations, maxIterations: true };
}

async function chatWithOllama({ messages, model, context, onDelta, onToolCall, onApproval }) {
  const baseUrl = getOllamaBaseUrl();
  const ollamaTools = selectChatTools(listTools()).map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema || { type: "object", properties: {} },
    },
  }));

  let currentMessages = [...messages];
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || getDefaultModel(),
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
        if (chunk.done) break;
      }
    }

    msg.tool_calls = (msg.tool_calls || []).filter((t) => t?.function?.name);
    if (!msg.tool_calls.length) {
      return { content: msg.content || "", iterations };
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
      const result = await runToolWithApproval(name, args, context, onToolCall, onApproval);
      currentMessages.push({
        role: "tool",
        content: JSON.stringify(result.ok ? result.data : result.error || result),
      });
    }
  }

  return { content: "", iterations, maxIterations: true };
}

export function registerUiChatRoutes(app) {
  app.get("/ui/chat/models", requireScope("read"), async (_req, res) => {
    const providerStatus = await checkProviderAvailable();
    res.json({
      models: listModels(),
      defaultModel: getDefaultModel(),
      provider: providerStatus.provider,
      providerAvailable: providerStatus.available,
      providerHint: providerStatus.hint || null,
      toolCount: listTools().length,
    });
  });

  app.post("/ui/chat/approve", requireScope("write"), async (req, res) => {
    const { approval_id, approved } = req.body ?? {};
    if (!approval_id) {
      return res.status(400).json({
        ok: false,
        error: { code: "missing_approval_id", message: "approval_id required" },
      });
    }

    const waiter = approvalWaiters.get(approval_id);
    if (!waiter) {
      return res.status(404).json({
        ok: false,
        error: { code: "approval_not_pending", message: "No pending chat approval for this id" },
      });
    }

    approvalWaiters.delete(approval_id);

    if (!approved) {
      const { getApprovalStore } = await import("./policy-hooks.js");
      getApprovalStore()?.updateApprovalStatus?.(approval_id, "rejected", "ui");
      waiter.resolve({
        ok: false,
        error: { code: "approval_rejected", message: "Kullanıcı tool çalıştırmayı reddetti" },
      });
      return res.json({ ok: true, data: { status: "rejected" } });
    }

    const approveResult = await approveTool(approval_id, { user: "ui" });
    const toolResult = approveResult.ok ? approveResult.data?.result : approveResult;
    waiter.resolve(toolResult || approveResult);
    res.json({ ok: true, data: { status: "approved", result: toolResult } });
  });

  app.post("/ui/chat", requireScope("read"), async (req, res) => {
    const {
      message,
      history = [],
      model,
      systemPrompt,
      task = DEFAULT_TASK,
      includeBrainContext = true,
      projectId,
    } = req.body ?? {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        ok: false,
        error: { code: "missing_message", message: "Provide message string in body" },
      });
    }

    const context = {
      method: "UI_CHAT",
      user: req.actor?.type || "ui",
      scopes: req.authScopes || [],
      projectId: projectId || req.projectId,
      projectEnv: req.projectEnv,
      requestId: req.requestId,
    };

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let brainBlock = "";
    if (includeBrainContext) {
      try {
        brainBlock = await buildCompactContext({ task: message, projectId: context.projectId });
      } catch {
        brainBlock = "";
      }
    }

    const systemContent = buildSystemPrompt(
      [systemPrompt, brainBlock].filter(Boolean).join("\n\n")
    );

    const messages = [
      { role: "system", content: systemContent },
      ...history.filter((m) => m?.role && m?.content).slice(-20),
      { role: "user", content: message },
    ];

    const tools = buildOpenAiTools();
    const useOpenAi = !!getOpenAiClient();
    if (!useOpenAi) {
      const status = await checkProviderAvailable();
      if (!status.available) {
        sseWrite(res, "error", { message: status.hint || "LLM provider unavailable" });
        res.end();
        return;
      }
    }

    sseWrite(res, "meta", {
      provider: useOpenAi ? "openai" : "ollama",
      model: model || getDefaultModel(),
      task,
      toolCount: tools.length,
      brainContext: !!brainBlock,
    });

    try {
      const handlers = {
        onDelta: (text) => sseWrite(res, "token", { text }),
        onToolCall: (payload) => sseWrite(res, "tool", payload),
        onApproval: (payload) => sseWrite(res, "approval", payload),
      };

      const result = useOpenAi
        ? await chatWithOpenAi({ messages, model, tools, context, ...handlers })
        : await chatWithOllama({ messages, model, context, ...handlers });

      sseWrite(res, "done", result);
      res.end();
    } catch (err) {
      sseWrite(res, "error", { message: err.message || "Chat failed" });
      res.end();
    }
  });
}
