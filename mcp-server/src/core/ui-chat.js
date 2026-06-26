/**
 * Web UI Chat — LLM + MCP tool loop with SSE streaming
 */

import { listModels, listConfiguredModelIds } from "../plugins/llm-router/index.js";
import { listTools } from "./tool-registry.js";
import { requireScope, isAuthEnabled } from "./auth.js";
import {
  checkProviderAvailable,
  getDefaultModel,
  getOpenAiClient,
  buildOpenAiTools,
  buildSystemPrompt,
  buildToolCatalogSummary,
  chatWithOpenAi,
  chatWithOllama,
  createBrainToolCounts,
  resolveChatApproval,
  getApprovalWaiter,
  selectChatTools,
  getChatProvider,
  assertChatQuota,
} from "./chat-orchestrator.js";
import { getChatContext } from "./chat/chat-context.js";
import { isPersistenceHealthy } from "./persistence/index.js";
import {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  archiveConversation,
  getConversationHistoryForChat,
  appendChatExchange,
} from "./chat/conversations.service.js";
import {
  normalizeConversationMetadata,
  buildInstructionsBlock,
  resolveIncludeBrainContext,
} from "./chat/chat-instructions.js";
import { ensureRunForChat, completeRun } from "./agent-runs/run-orchestrator.js";
import { CHAT_HISTORY_RAW_LIMIT } from "./chat/chat-config.js";
import { maybeCompressConversation } from "./chat/conversation-compression.js";
import { resolveChatProfile } from "./chat/chat-profiles.js";

const DEFAULT_TASK = "general";

function sseWrite(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function persistenceError(res) {
  return res.status(503).json({
    ok: false,
    error: { code: "persistence_unavailable", message: "Chat persistence requires MSSQL (HUB_PERSISTENCE_ENABLED)" },
  });
}

export function registerUiChatRoutes(app) {
  app.get("/ui/chat/models", requireScope("read"), async (_req, res) => {
    const providerStatus = await checkProviderAvailable();
    const allModels = listModels();
    res.json({
      models: allModels,
      availableModels: allModels.filter((m) => m.available),
      selectableModels: listConfiguredModelIds(),
      defaultModel: getDefaultModel(),
      provider: providerStatus.provider,
      providerAvailable: providerStatus.available,
      providerHint: providerStatus.hint || null,
      toolCount: listTools().length,
      persistenceEnabled: isPersistenceHealthy(),
    });
  });

  app.get("/ui/chat/conversations", requireScope("read"), async (req, res) => {
    if (!isPersistenceHealthy()) return persistenceError(res);
    try {
      res.setHeader("Cache-Control", "no-store");
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
      const offset = parseInt(req.query.offset, 10) || 0;
      const scope = String(req.query.scope || "all");
      let projectId;
      if (scope === "unassigned") {
        projectId = null;
      } else if (scope === "current") {
        projectId = req.projectId || undefined;
        if (!projectId) {
          return res.json({ ok: true, data: { conversations: [] } });
        }
      } else if (scope === "project" && req.query.projectId) {
        projectId = String(req.query.projectId);
      } else {
        projectId = undefined;
      }
      const conversations = await listConversations({ projectId, limit, offset });
      res.json({ ok: true, data: { conversations } });
    } catch (err) {
      const status = err.code === "persistence_unavailable" ? 503 : 500;
      res.status(status).json({ ok: false, error: { code: err.code || "list_failed", message: err.message } });
    }
  });

  app.post("/ui/chat/conversations", requireScope("write"), async (req, res) => {
    if (!isPersistenceHealthy()) return persistenceError(res);
    try {
      const { title, model, projectId: bodyProjectId, metadata } = req.body ?? {};
      const hasExplicitProject = req.body != null && Object.prototype.hasOwnProperty.call(req.body, "projectId");
      const projectId = hasExplicitProject ? bodyProjectId ?? null : req.projectId || null;
      const conversation = await createConversation({
        title: title || "Yeni sohbet",
        model: model || null,
        projectId,
        metadata: metadata || null,
      });
      res.status(201).json({ ok: true, data: conversation });
    } catch (err) {
      const status = err.code === "persistence_unavailable" ? 503 : 500;
      res.status(status).json({ ok: false, error: { code: err.code || "create_failed", message: err.message } });
    }
  });

  app.get("/ui/chat/conversations/:id", requireScope("read"), async (req, res) => {
    if (!isPersistenceHealthy()) return persistenceError(res);
    try {
      res.setHeader("Cache-Control", "no-store");
      const conversation = await getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Conversation not found" } });
      }
      res.json({ ok: true, data: conversation });
    } catch (err) {
      const status = err.code === "persistence_unavailable" ? 503 : 500;
      res.status(status).json({ ok: false, error: { code: err.code || "get_failed", message: err.message } });
    }
  });

  app.patch("/ui/chat/conversations/:id", requireScope("write"), async (req, res) => {
    if (!isPersistenceHealthy()) return persistenceError(res);
    try {
      const { title, model, metadata } = req.body ?? {};
      const conversation = await updateConversation(req.params.id, { title, model, metadata });
      if (!conversation) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Conversation not found" } });
      }
      res.json({ ok: true, data: conversation });
    } catch (err) {
      const status = err.code === "persistence_unavailable" ? 503 : 500;
      res.status(status).json({ ok: false, error: { code: err.code || "update_failed", message: err.message } });
    }
  });

  app.delete("/ui/chat/conversations/:id", requireScope("write"), async (req, res) => {
    if (!isPersistenceHealthy()) return persistenceError(res);
    try {
      await archiveConversation(req.params.id);
      res.json({ ok: true, data: { id: req.params.id, archived: true } });
    } catch (err) {
      const status = err.code === "persistence_unavailable" ? 503 : 500;
      res.status(status).json({ ok: false, error: { code: err.code || "delete_failed", message: err.message } });
    }
  });

  app.post("/ui/chat/approve", requireScope("write"), async (req, res) => {
    const { approval_id, approved } = req.body ?? {};
    if (!approval_id) {
      return res.status(400).json({
        ok: false,
        error: { code: "missing_approval_id", message: "approval_id required" },
      });
    }

    const waiter = getApprovalWaiter(approval_id);
    if (!waiter) {
      return res.status(404).json({
        ok: false,
        error: { code: "approval_not_pending", message: "No pending chat approval for this id" },
      });
    }

    const outcome = await resolveChatApproval(approval_id, approved);
    if (!outcome) {
      return res.status(404).json({
        ok: false,
        error: { code: "approval_not_pending", message: "No pending chat approval for this id" },
      });
    }

    if (outcome.status === "rejected") {
      return res.json({ ok: true, data: { status: "rejected" } });
    }

    res.json({ ok: true, data: { status: "approved", result: outcome.result } });
  });

  app.post("/ui/chat", requireScope("read"), async (req, res) => {
    const {
      message,
      history = [],
      model,
      systemPrompt,
      responseStyle,
      task = DEFAULT_TASK,
      includeBrainContext: includeBrainContextBody,
      projectId,
      conversationId,
      autoCreate = true,
      pluginFilter,
    } = req.body ?? {};

    const allowWriteTools =
      !isAuthEnabled() ||
      (req.authScopes ?? []).some((s) => s === "write" || s === "admin");

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        ok: false,
        error: { code: "missing_message", message: "Provide message string in body" },
      });
    }

    const context = {
      guardBlocks: [],
      method: "UI_CHAT",
      user: req.actor?.type || "ui",
      scopes: req.authScopes || [],
      projectId: projectId || req.projectId,
      projectEnv: req.projectEnv,
      requestId: req.requestId,
      source: "chat_ui",
      channel: "web",
      conversationId: conversationId || null,
      brainToolCounts: createBrainToolCounts(),
      readToolsUsed: false,
    };

    let activeConversationId = conversationId || null;
    let chatHistory = history.filter((m) => m?.role && m?.content);
    let conversationMetadata = {};
    let historySummaryBlock = "";

    if (isPersistenceHealthy()) {
      try {
        if (activeConversationId) {
          void maybeCompressConversation(activeConversationId).catch(() => {});
          const conv = await getConversation(activeConversationId);
          if (conv) {
            conversationMetadata = normalizeConversationMetadata(conv.metadata);
          }
          const loaded = await getConversationHistoryForChat(activeConversationId, {
            limit: CHAT_HISTORY_RAW_LIMIT,
          });
          if (loaded) {
            chatHistory = loaded.history;
            historySummaryBlock = loaded.summaryBlock || "";
          }
        } else if (autoCreate) {
          const created = await createConversation({
            projectId: context.projectId || null,
            model: model || null,
          });
          activeConversationId = created.id;
        }
      } catch (err) {
        console.warn("[ui-chat] persistence load/create failed:", err.message);
      }
    }

    context.conversationId = activeConversationId;

    let activeRun = null;
    try {
      activeRun = await ensureRunForChat({
        conversationId: activeConversationId,
        goal: message,
        projectId: context.projectId || null,
        createdBy: req.actor?.type || "ui",
        metadata: { source: "chat_ui", requestId: req.requestId },
      });
      context.runId = activeRun?.id || null;
    } catch (err) {
      console.warn("[ui-chat] run ensure failed:", err.message);
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const includeBrainContext = resolveIncludeBrainContext(conversationMetadata, includeBrainContextBody);
    const instructionsBlock = buildInstructionsBlock(
      conversationMetadata,
      systemPrompt,
      responseStyle
    );

    const chatProfile = resolveChatProfile(conversationMetadata.chatProfile).id;

    const chatCtx = await getChatContext({
      message,
      projectId: context.projectId,
      conversationId: activeConversationId,
      includeBrainContext,
      hasConversationHistory: chatHistory.length > 0,
      chatProfile,
      historySummaryBlock,
    });
    context.intent = chatCtx.toolIntent;

    const scopedPlugin =
      typeof pluginFilter === "string" && pluginFilter.trim() ? pluginFilter.trim().toLowerCase() : null;

    const toolSelectOpts = {
      allowWriteTools,
      pluginFilter: scopedPlugin,
      toolIntent: scopedPlugin ? null : chatCtx.toolIntent,
      chatProfile,
    };
    const scopedToolDefs = selectChatTools(listTools(), toolSelectOpts);
    const toolCatalog = scopedPlugin ? "" : buildToolCatalogSummary(scopedToolDefs);

    const systemContent = buildSystemPrompt(
      [instructionsBlock, chatCtx.contextHints].filter(Boolean).join("\n\n"),
      {
        toolCatalog,
        pluginFilter: scopedPlugin,
        scopedTools: scopedPlugin ? scopedToolDefs : [],
      }
    );

    const messages = [
      { role: "system", content: systemContent },
      ...chatHistory.slice(-CHAT_HISTORY_RAW_LIMIT),
      { role: "user", content: message },
    ];

    const tools = buildOpenAiTools(toolSelectOpts);
    const useOpenAi = !!getOpenAiClient();
    if (!useOpenAi) {
      const status = await checkProviderAvailable();
      if (!status.available) {
        sseWrite(res, "error", { message: status.hint || "LLM provider unavailable" });
        res.end();
        return;
      }
    }

    try {
      const quota = await assertChatQuota(context.projectId);
      if (quota.warning) {
        sseWrite(res, "quota_warning", {
          message: "Project approaching usage quota",
          usage: quota.usage,
          quota: quota.quota,
        });
      }
    } catch (err) {
      if (err.code === "quota_exceeded") {
        sseWrite(res, "error", { code: "quota_exceeded", message: err.message });
        res.end();
        return;
      }
    }

    sseWrite(res, "meta", {
      provider: useOpenAi ? getChatProvider() : "ollama",
      model: model || getDefaultModel(),
      task,
      toolCount: tools.length,
      brainContext: chatCtx.meta.brainContextInjected,
      projectContext: chatCtx.meta.projectContextInjected,
      contextStrategy: chatCtx.meta.contextStrategy,
      toolIntent: chatCtx.meta.toolIntent,
      toolIntentSource: chatCtx.meta.toolIntentSource,
      modelVersion: chatCtx.meta.modelVersion,
      chatProfile: chatCtx.meta.chatProfile,
      pluginFilter: scopedPlugin,
      conversationId: activeConversationId,
      runId: context.runId,
    });

    const toolMessages = [];

    try {
      const handlers = {
        allowWriteTools,
        onDelta: (text) => sseWrite(res, "token", { text }),
        onToolCall: (payload) => {
          if (payload.phase === "end" && payload.name) {
            const summaryText =
              payload.summary?.summary ||
              (typeof payload.result === "string"
                ? payload.result
                : JSON.stringify(payload.result ?? {}));
            toolMessages.push({
              content: summaryText.slice(0, 2000),
              metadata: {
                toolName: payload.name,
                toolPhase: "end",
                toolSummary: payload.summary || null,
              },
            });
          }
          sseWrite(res, "tool", payload);
          if (context.runId) {
            sseWrite(res, "run_step", {
              runId: context.runId,
              type: "tool",
              phase: payload.phase,
              toolName: payload.name,
              status: payload.phase === "end" ? (payload.result?.ok === false ? "error" : "ok") : "pending",
            });
          }
        },
        onApproval: (payload) => {
          sseWrite(res, "approval", payload);
          if (context.runId) {
            sseWrite(res, "run_step", {
              runId: context.runId,
              type: "approval",
              toolName: payload.tool,
              status: "pending",
              approvalId: payload.approvalId,
            });
          }
        },
      };

      const result = useOpenAi
        ? await chatWithOpenAi({ messages, model, tools, context, handlers })
        : await chatWithOllama({ messages, model, tools, context, handlers });

      if (activeConversationId && isPersistenceHealthy()) {
        try {
          await appendChatExchange(activeConversationId, {
            userMessage: message,
            assistantMessage: result.text,
            assistantMetadata: result.usage
              ? { usage: { ...result.usage, iterations: result.iterations } }
              : null,
            toolMessages,
            autoTitle: true,
          });
        } catch (err) {
          console.warn("[ui-chat] persistence append failed:", err.message);
        }
      }

      sseWrite(res, "done", {
        content: result.text,
        iterations: result.iterations,
        maxIterations: result.maxIterations,
        conversationId: activeConversationId,
        runId: context.runId,
        usage: result.usage || null,
      });
      if (context.runId) {
        try {
          await completeRun(context.runId, { usage: result.usage });
        } catch (err) {
          console.warn("[ui-chat] run complete failed:", err.message);
        }
      }

      try {
        const { getIntentTrainConfig } = await import("./chat/tool-intent-config.js");
        const { recordIntentSample } = await import("./chat/tool-intent-samples.service.js");
        if (getIntentTrainConfig().collectEnabled) {
          void recordIntentSample({
            userMessage: message,
            predictedIntent: chatCtx.toolClassification.intent,
            predictedConfidence: chatCtx.toolClassification.confidence,
            predictionSource: chatCtx.toolClassification.source || "regex",
            effectiveIntent: chatCtx.toolIntent,
            toolsUsed: toolMessages.map((t) => t.metadata?.toolName).filter(Boolean),
            guardBlocks: context.guardBlocks || [],
            projectId: context.projectId,
            conversationId: activeConversationId,
            runId: context.runId,
            chatProfile: chatCtx.meta.chatProfile,
            modelVersion: chatCtx.toolClassification.modelVersion,
          });
        }
      } catch (err) {
        console.warn("[ui-chat] intent sample log failed:", err.message);
      }

      res.end();
    } catch (err) {
      if (context.runId) {
        try {
          await completeRun(context.runId, { error: { message: err.message } });
        } catch {
          /* ignore */
        }
      }
      sseWrite(res, "error", { message: err.message || "Chat failed" });
      res.end();
    }
  });
}
