import express from "express";
import "express-async-errors";
import cors from "cors";
import morgan from "morgan";
import { AppError, NotFoundError } from "./errors.js";
import { config } from "./config.js";
import { loadPlugins, getPlugins } from "./plugins.js";
import { initializeToolHooks } from "./tool-registry.js";
import { auditMiddleware, getLogs, getStats } from "./audit.js";
import { getAuditManager, initAuditManager } from "./audit/index.js";
import { requireScope, isAuthEnabled, optionalAuthMiddleware } from "./auth.js";
import { submitJob, getJob, listJobs, getJobStats } from "./jobs.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";
import { loadPresetsAtStartup, policyGuardrailMiddleware } from "./policy-guard.js";
import { getApprovalStore } from "./policy-hooks.js";
import { callTool } from "./tool-registry.js";
import { createMcpHttpMiddleware } from "../mcp/http-transport.js";
import { issueUiToken, issueUiTokenWithNotification } from "./ui-tokens.js";
import { registerUiChatRoutes } from "./ui-chat.js";
import { registerAgentRunRoutes } from "./agent-runs/routes.js";
import { registerAgentRunJobRunner } from "./agent-runs/agent-run-job.js";
import { registerWorkflowRunJobRunner } from "./agent-runs/workflow-run-job.js";
import { registerAgentRunTools } from "./agent-runs/agent-runs.tools.js";
import { resolvePendingApproval } from "./agent-runs/approval-bridge.js";
import { registerUsageRoutes } from "./usage/routes.js";
import { purgeOlderThan } from "./usage/usage-ledger.service.js";
import { initPersistence, getPersistenceStatus, isPersistenceHealthy } from "./persistence/index.js";
import { initMasterKey } from "./settings/crypto.js";
import { loadSettingsOverlay } from "./settings/effective-config.js";
import { registerSettingsRoutes } from "./settings/routes.js";
import { registerReloadHooks } from "./settings/reload-registry.js";
import { rateLimitMiddleware } from "./ratelimit.js";

import { workspaceContextMiddleware } from "./workspace.js";

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Extract path parameters from Express-style route paths
 * e.g., "/workspace/:id/file/:name" → [{name: "id", in: "path", required: true, schema: {type: "string"}}, ...]
 * @param {string} path - Express route path
 * @returns {Object[]} OpenAPI parameter definitions
 */
function extractPathParams(path) {
  const params = [];
  const paramRegex = /:(\w+)/g;
  let match;
  while ((match = paramRegex.exec(path)) !== null) {
    params.push({
      name: match[1],
      in: "path",
      required: true,
      schema: { type: "string" },
    });
  }
  return params;
}

/**
 * Normalize all JSON responses to a single envelope:
 *  - success: { ok: true, data, meta: { requestId } }
 *  - error:   { ok: false, error: { code, message, details? }, meta: { requestId } }
 */
function responseEnvelopeMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    const requestId = req.requestId ?? null;

    // MCP clients expect raw JSON-RPC result payloads, not the REST envelope.
    if (req.path === "/mcp") {
      return originalJson(payload);
    }

    // If already in the new envelope, pass through.
    if (isPlainObject(payload) && (payload.ok === true || payload.ok === false) && payload.meta && "requestId" in payload.meta) {
      return originalJson(payload);
    }

    // If it's an AppError-like serialized payload from older shape, normalize it.
    if (isPlainObject(payload) && payload.ok === false) {
      // legacy: { ok:false, error:"code", message, details?, requestId? }
      if (typeof payload.error === "string") {
        const out = {
          ok: false,
          error: {
            code: payload.error,
            message: payload.message ?? "Request failed",
            ...(payload.details != null ? { details: payload.details } : {}),
          },
          meta: { requestId: payload.requestId ?? requestId },
        };
        return originalJson(out);
      }
      // new-ish: { ok:false, error:{code,message,details?}, meta? }
      if (isPlainObject(payload.error) && typeof payload.error.code === "string") {
        const out = {
          ok: false,
          error: payload.error,
          meta: { requestId: payload?.meta?.requestId ?? requestId },
        };
        return originalJson(out);
      }
    }

    // Plugin routes often return { ok, data } without meta — normalize once.
    if (isPlainObject(payload) && payload.ok === true && "data" in payload && !payload.meta) {
      return originalJson({
        ok: true,
        data: payload.data,
        meta: { requestId },
      });
    }

    // Success normalization.
    const out = {
      ok: true,
      data: payload,
      meta: { requestId },
    };
    return originalJson(out);
  };
  next();
}

/**
 * Correlation ID Middleware
 * Generates or extracts correlation ID for request tracing
 */
function correlationIdMiddleware(req, res, next) {
  // Use provided correlation ID or generate new one
  req.correlationId = req.headers["x-correlation-id"] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = req.correlationId; // Compatibility with existing code
  
  // Expose correlation ID in response
  res.setHeader("x-correlation-id", req.correlationId);
  
  next();
}

/**
 * Project Context Middleware
 *
 * Behavior:
 * - In development/local (default): Missing headers resolve to configurable defaults
 * - In production (REQUIRE_PROJECT_HEADERS=true): Missing headers return 400 error
 *
 * Resolution order:
 * 1. x-project-id header → req.projectId
 * 2. x-env header → req.projectEnv
 * 3. If headers missing and requireHeaders=false: use defaults
 * 4. If headers missing and requireHeaders=true: return 400 error
 *
 * Environment variables:
 * - REQUIRE_PROJECT_HEADERS: Set to "true" to enforce header requirements
 * - DEFAULT_PROJECT_ID: Override default project (default: "default-project")
 * - DEFAULT_ENV: Override default environment (default: "default-env")
 */
function projectContextMiddleware(req, res, next) {
  const headerProjectId = req.headers["x-project-id"]?.trim();
  const headerEnv = req.headers["x-env"]?.trim();

  // Check if headers are required (production multi-tenant mode)
  const requireHeaders =
    process.env.REQUIRE_PROJECT_HEADERS === "true" ||
    config?.projectContext?.requireHeaders === true;

  if (requireHeaders) {
    if (!headerProjectId || !headerEnv) {
      return res.status(400).json({
        ok: false,
        error: {
          code: "missing_project_context",
          message: "x-project-id and x-env headers are required",
        },
      });
    }
    req.projectId = headerProjectId;
    req.projectEnv = headerEnv;
    return next();
  }

  // Development/local mode: use defaults if headers missing
  const defaultProjectId =
    config?.projectContext?.defaults?.projectId ||
    process.env.DEFAULT_PROJECT_ID ||
    "default-project";
  const defaultEnv =
    config?.projectContext?.defaults?.env ||
    process.env.DEFAULT_ENV ||
    "default-env";

  req.projectId = headerProjectId || defaultProjectId;
  req.projectEnv = headerEnv || defaultEnv;

  // Log when using defaults (helpful for debugging)
  if (!headerProjectId || !headerEnv) {
    console.warn(
      `[server] Using default project context (${req.projectId}/${req.projectEnv}). ` +
      `Set x-project-id and x-env headers to override, or set REQUIRE_PROJECT_HEADERS=true to enforce headers.`
    );
  }

  next();
}

export async function createServer() {
  const app = express();

  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS?.trim();
  if (corsOrigins) {
    const originList = corsOrigins.split(",").map((s) => s.trim()).filter(Boolean);
    app.use(cors({ origin: originList.length === 1 ? originList[0] : originList }));
  } else {
    app.use(cors());
  }
  app.use(morgan("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const hubRateLimitRpm = Number(
    process.env.HUB_RATE_LIMIT_RPM ?? (config.nodeEnv === "production" ? 120 : 0)
  );
  if (hubRateLimitRpm > 0) {
    app.use(
      rateLimitMiddleware({
        name: "hub-api",
        maxRequests: hubRateLimitRpm,
        windowMs: 60_000,
        keyGenerator: (req) => {
          const apiKey = req.headers["x-api-key"];
          if (typeof apiKey === "string" && apiKey) {
            return `key:${apiKey.slice(0, 12)}`;
          }
          return req.ip ?? req.socket?.remoteAddress ?? "unknown";
        },
      })
    );
  }

  app.use(correlationIdMiddleware);
  app.use(projectContextMiddleware);
  app.use(workspaceContextMiddleware);
  app.use(auditMiddleware);
  app.use(responseEnvelopeMiddleware);
  app.use(optionalAuthMiddleware);
  app.use(policyGuardrailMiddleware);

  // ── Core routes ────────────────────────────────────────────────────────────

  app.get("/health", (req, res) => {
    const persistence = getPersistenceStatus();
    res.json({
      status: "ok",
      auth: isAuthEnabled() ? "enabled" : "disabled",
      persistence,
    });
  });

  app.get("/whoami", requireScope("read"), (req, res) => {
    res.json({
      auth: {
        enabled: isAuthEnabled(),
        scopes: req.authScopes ?? [],
      },
      actor: req.actor ?? null,
      project: {
        id: req.projectId,
        env: req.projectEnv,
      },
    });
  });

  app.get("/plugins", requireScope("read"), (req, res) => {
    res.json(getPlugins());
  });

  app.get("/plugins/:name/manifest", requireScope("read"), (req, res) => {
    const plugins = getPlugins();
    const plugin  = plugins.find((p) => p.name === req.params.name);
    if (!plugin) return res.status(404).json({ ok: false, error: { code: "plugin_not_found", message: "Plugin not found" } });
    res.json(plugin);
  });

  /**
   * GET /openapi.json
   * Auto-generated OpenAPI spec from all plugin manifests.
   */
  app.get("/openapi.json", requireScope("read"), (_req, res) => {
    const plugins = getPlugins();
    const paths = {};

    for (const plugin of plugins) {
      for (const ep of plugin.endpoints ?? []) {
        const pathKey = ep.path.replace(/:(\w+)/g, "{$1}");
        if (!paths[pathKey]) paths[pathKey] = {};

        const method = ep.method.toLowerCase();
        const pathParams = extractPathParams(ep.path);

        paths[pathKey][method] = {
          summary: ep.description ?? `${ep.method} ${ep.path}`,
          operationId: `${plugin.name}_${method}_${ep.path.replace(/[^a-zA-Z0-9]/g, "_")}`,
          tags: ep.tags ?? [plugin.name],
          security: ep.scope ? [{ bearerAuth: [] }] : [],
          parameters: [
            ...pathParams,
            ...(ep.scope ? [{ name: "Authorization", in: "header", required: true, schema: { type: "string" } }] : []),
          ].filter(Boolean),
          requestBody: ep.requestSchema ? {
            content: { "application/json": { schema: ep.requestSchema } },
          } : undefined,
          responses: {
            "200": {
              description: "Success",
              content: {
                "application/json": {
                  schema: ep.responseSchema ?? {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      data: { type: "object" },
                      meta: { type: "object", properties: { requestId: { type: "string" } } },
                    },
                  },
                },
              },
            },
            "400": { description: "Bad Request" },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
            "429": { description: "Rate Limited" },
          },
        };
      }
    }

    const openApiSpec = {
      openapi: "3.0.3",
      info: {
        title: "AI-Hub API",
        version: "1.0.0",
        description: "Universal tool and service bridge for AI agents",
      },
      servers: [{ url: "http://localhost:8787" }],
      security: [{ bearerAuth: [] }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "API key",
          },
        },
      },
      paths,
    };

    res.json(openApiSpec);
  });

  // ── Audit routes ───────────────────────────────────────────────────────────

  app.get("/audit/logs", requireScope("read"), async (req, res) => {
    const { plugin, status, limit } = req.query;
    const logs = await getLogs({ plugin, status, limit: Number(limit) || 100 });
    res.json({ count: logs.length, logs });
  });

  app.get("/audit/stats", requireScope("read"), async (req, res) => {
    res.json({ stats: await getStats() });
  });

  /** GET /audit/events — unified audit query (http | tool | plugin) */
  app.get("/audit/events", requireScope("read"), async (req, res) => {
    const { source, plugin, operation, limit = 100, offset = 0 } = req.query;
    const { queryAuditEvents } = await import("./audit/audit.service.js");
    const entries = await queryAuditEvents({
      source: source ? String(source) : undefined,
      plugin: plugin ? String(plugin) : undefined,
      operation: operation ? String(operation) : undefined,
      limit: Math.min(Number(limit) || 100, 500),
      offset: Number(offset) || 0,
    });
    res.json({ entries, count: entries.length });
  });

  /** GET /audit/operations — plugin operation audit (core audit manager), filter by plugin, operation, limit */
  app.get("/audit/operations", requireScope("read"), async (req, res) => {
    const { plugin, operation, limit = 100, offset = 0 } = req.query;
    const manager = getAuditManager();
    if (!manager.initialized) await manager.init();
    const entries = await manager.getRecentEntries({
      limit: Math.min(Number(limit) || 100, 500),
      offset: Number(offset) || 0,
      ...(plugin && { plugin: String(plugin) }),
      ...(operation && { operation: String(operation) }),
    });
    res.json({ entries, count: entries.length });
  });

  /** GET /audit/archive — MSSQL audit_archive (paginated); memory fallback when degraded */
  app.get("/audit/archive", requireScope("read"), async (req, res) => {
    const { plugin, operation, limit = 100, offset = 0 } = req.query;
    const lim = Math.min(Number(limit) || 100, 500);
    const off = Number(offset) || 0;

    if (isPersistenceHealthy()) {
      const { MssqlAuditSink } = await import("./audit/sinks/mssql.audit.js");
      const sink = new MssqlAuditSink();
      const entries = await sink.read(lim, off, {
        ...(plugin && { plugin: String(plugin) }),
        ...(operation && { operation: String(operation) }),
      });
      const stats = await sink.stats();
      return res.json({ source: "mssql", entries, count: entries.length, total: stats.count });
    }

    const manager = getAuditManager();
    if (!manager.initialized) await manager.init();
    const entries = await manager.getRecentEntries({
      limit: lim,
      offset: off,
      ...(plugin && { plugin: String(plugin) }),
      ...(operation && { operation: String(operation) }),
    });
    res.json({ source: "memory", entries, count: entries.length, persistence: getPersistenceStatus() });
  });

  // ── Job queue routes ───────────────────────────────────────────────────────

  app.post("/jobs", requireScope("write"), async (req, res) => {
    const { type, payload } = req.body ?? {};
    if (!type) return res.status(400).json({ ok: false, error: { code: "missing_type", message: "Provide job type" } });

    try {
      // Submit job to the real jobs system - requires a registered runner
      const job = submitJob(type, payload ?? {}, {
        projectId: req.projectId,
        projectEnv: req.projectEnv,
        user: req.user || req.actor?.id,
      });

      res.status(202).json({
        ok: true,
        data: {
          job: {
            id: job.id,
            type: job.type,
            state: job.state,
            context: job.context,
            progress: job.progress,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            finishedAt: job.finishedAt,
          },
        },
        meta: { requestId: req.requestId },
      });
    } catch (err) {
      // No runner registered for this job type
      if (err.message?.includes("No runner registered")) {
        return res.status(400).json({
          ok: false,
          error: {
            code: "job_type_not_supported",
            message: `No job handler registered for type: "${type}". Available job types must be registered by plugins.`,
          },
          meta: { requestId: req.requestId },
        });
      }

      // Other errors
      return res.status(500).json({
        ok: false,
        error: {
          code: "job_submission_failed",
          message: err.message || "Failed to submit job",
        },
        meta: { requestId: req.requestId },
      });
    }
  });

  app.get("/jobs/stats", requireScope("read"), async (req, res) => {
    const stats = await getJobStats();
    res.json({ ok: true, stats });
  });

  app.get("/jobs", requireScope("read"), async (req, res) => {
    const { state, type, limit } = req.query;
    const jobs = await listJobs({ state, type, limit: Number(limit) || 50 });
    res.json({ count: jobs.length, jobs });
  });

  app.get("/jobs/:id", requireScope("read"), async (req, res) => {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ ok: false, error: { code: "job_not_found", message: "Job not found" } });
    res.json({ job });
  });

  // ── Approval routes ──────────────────────────────────────────────────────

  /**
   * POST /tools/:name/dry-run
   * Simulate tool execution without side effects.
   */
  app.post("/tools/:name/dry-run", requireScope("read"), async (req, res) => {
    const toolName = req.params.name;
    const args = req.body?.arguments ?? req.body ?? {};
    try {
      const result = await callTool(toolName, args, {
        dryRun: true,
        scopes: req.authScopes,
        user: req.actor?.type || "dry-run",
        projectId: req.projectId,
        projectEnv: req.projectEnv,
        requestId: req.requestId,
        method: "POST",
      });
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "dry_run_failed", message: err.message } });
    }
  });

  /**
   * GET /approvals/pending
   * Return all pending approval requests
   */
  app.get("/approvals/pending", requireScope("read"), (req, res) => {
    const approvalStore = getApprovalStore();
    if (!approvalStore?.listApprovals) {
      return res.status(503).json({
        ok: false,
        error: { code: "policy_unavailable", message: "Policy system not available" }
      });
    }
    const approvals = approvalStore.listApprovals({ status: "pending" });
    res.json({
      ok: true,
      data: {
        count: approvals.length,
        approvals,
      },
    });
  });

  /**
   * POST /approve
   * Approve a pending tool execution and execute it
   */
  app.post("/approve", requireScope("write"), async (req, res) => {
    const { approval_id } = req.body ?? {};

    if (!approval_id) {
      return res.status(400).json({
        ok: false,
        error: {
          code: "missing_approval_id",
          message: "approval_id is required",
        },
      });
    }

    const approvalStore = getApprovalStore();
    if (!approvalStore?.getApproval || !approvalStore?.updateApprovalStatus) {
      return res.status(503).json({
        ok: false,
        error: { code: "policy_unavailable", message: "Policy system not available" }
      });
    }

    // Retrieve the approval request
    const approval = approvalStore.getApproval(approval_id);
    if (!approval) {
      return res.status(404).json({
        ok: false,
        error: {
          code: "approval_not_found",
          message: `Approval request not found: ${approval_id}`,
        },
      });
    }

    if (approval.status !== "pending") {
      return res.status(400).json({
        ok: false,
        error: {
          code: "approval_already_processed",
          message: `Approval already ${approval.status}`,
          approval: {
            id: approval.id,
            status: approval.status,
          },
        },
      });
    }

    const runId = approval.runId || null;
    const outcome = await resolvePendingApproval(approval_id, true, {
      actor: req.user || req.actor?.type || "manual",
      runId,
      scopes: req.authScopes,
    });

    if (!outcome) {
      return res.status(404).json({
        ok: false,
        error: { code: "approval_not_found", message: `Approval request not found: ${approval_id}` },
      });
    }

    console.log(`[APPROVAL] Resolved ${approval_id} via ${outcome.via}`);

    res.json({
      ok: true,
      data: {
        approval: {
          id: approval_id,
          status: outcome.status,
          executedAt: new Date().toISOString(),
        },
        result: outcome.result,
        via: outcome.via,
      },
    });
  });

  // ── MCP Gateway ──────────────────────────────────────────────────────────────

  app.all("/mcp", createMcpHttpMiddleware());

  // ── React SPA (unified UI) ─────────────────────────────────────────────────

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const appDistPath = join(__dirname, "..", "public", "app");

  // Legacy URL redirects (do not catch /ui/chat/* API routes)
  app.get(["/ui", "/ui/"], (_req, res) => res.redirect(301, "/chat"));
  app.get(["/observability/dashboard", "/observability/dashboard/"], (_req, res) =>
    res.redirect(301, "/observability")
  );

  app.post("/ui/token", (req, res) => {
    const ip = req.ip || "";
    const isLocal = ip === "127.0.0.1" || ip === "::1" || ip.endsWith("::ffff:127.0.0.1");
    if (!isLocal) {
      return res.status(403).json({
        ok: false,
        error: { code: "forbidden", message: "UI token issuance is only allowed from localhost" },
        meta: { requestId: req.requestId },
      });
    }

    const silent = req.body?.silent === true;
    const defaultTtl = silent ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
    const ttlMs = Number(process.env.UI_TOKEN_TTL_MS) || defaultTtl;
    const issue = silent
      ? Promise.resolve(issueUiToken({ ttlMs }))
      : issueUiTokenWithNotification({ ttlMs });

    issue
      .then(({ token, expiresAt }) => {
        res.json({
          ok: true,
          data: {
            token,
            expiresAt,
            ttlMs,
            delivery: silent ? "silent" : "notification",
          },
          meta: { requestId: req.requestId },
        });
      })
      .catch((err) => {
        res.status(500).json({
          ok: false,
          error: { code: "token_issue_failed", message: err.message },
          meta: { requestId: req.requestId },
        });
      });
  });

  registerUiChatRoutes(app);
  registerAgentRunJobRunner();
  registerWorkflowRunJobRunner();
  registerAgentRunRoutes(app);
  registerUsageRoutes(app);

  // ── Plugin loader ──────────────────────────────────────────────────────────

  await initPersistence();
  try {
    initMasterKey();
  } catch (err) {
    console.warn(`[settings] Master key init failed: ${err.message}`);
  }
  if (isPersistenceHealthy()) {
    const count = await loadSettingsOverlay();
    if (count > 0) console.log(`[settings] Loaded ${count} encrypted setting(s) from MSSQL`);

    purgeOlderThan(90).then((deleted) => {
      if (deleted > 0) console.log(`[usage-ledger] Purged ${deleted} event(s) older than 90 days`);
    }).catch((err) => console.warn("[usage-ledger] Purge failed:", err.message));

    setInterval(() => {
      purgeOlderThan(90).catch((err) => console.warn("[usage-ledger] Scheduled purge failed:", err.message));
    }, 24 * 60 * 60 * 1000);
  }
  registerSettingsRoutes(app);

  const persistenceStatus = getPersistenceStatus();
  const auditSinks = ["memory"];
  if (persistenceStatus.status === "healthy") {
    auditSinks.push("mssql");
  }
  await initAuditManager({ sinks: auditSinks, memoryMaxEntries: 1000 });

  // Load policy presets at startup
  loadPresetsAtStartup();

  // Initialize tool registry hooks (policy, auditing, etc.)
  initializeToolHooks();

  await loadPlugins(app);
  registerAgentRunTools();

  try {
    const { startTelegramPolling } = await import("../plugins/notifications/telegram.webhook.js");
    startTelegramPolling();
  } catch (err) {
    console.warn("[telegram] Polling startup skipped:", err.message);
  }

  try {
    const { clearLlmClientCache } = await import("../plugins/llm-router/index.js");
    const mssqlAdapter = await import("../plugins/database/adapters/mssql.js");
    registerReloadHooks({
      llmClients: async () => clearLlmClientCache(),
      databasePool: async () => mssqlAdapter.reloadPool(),
    });
  } catch (err) {
    console.warn("[settings] Reload hooks registration failed:", err.message);
  }

  // ── React SPA static + HTML fallback ───────────────────────────────────────

  const spaIndexPath = join(appDistPath, "index.html");
  const spaApiPrefixes = [
    "/mcp",
    "/health",
    "/openapi",
    "/plugins",
    "/audit",
    "/jobs",
    "/approvals",
    "/approve",
    "/ui/chat",
    "/ui/token",
    "/whoami",
    "/brain",
    "/settings/reload",
    "/settings/effective",
    "/settings/connections",
    "/observability/health",
    "/observability/metrics",
    "/observability/errors",
  ];

  if (existsSync(spaIndexPath)) {
    app.use(express.static(appDistPath, { index: false }));
    app.get("*", (req, res, next) => {
      if (req.method !== "GET") return next();
      if (spaApiPrefixes.some((p) => req.path === p || req.path.startsWith(`${p}/`))) return next();
      if (req.path.includes(".")) return next();
      const accept = req.headers.accept || "";
      const wantsHtml = accept.includes("text/html") || accept.includes("*/*") || accept === "";
      if (!wantsHtml) return next();
      res.setHeader("Cache-Control", "no-store");
      res.sendFile(spaIndexPath);
    });
  } else {
    console.warn("[spa] Build not found — run: npm run ui:build");
    app.get("/", (_req, res) => {
      res.json({
        ok: true,
        message: "mcp-hub API running — UI not built",
        hint: "cd mcp-server && npm run ui:build",
        docs: "/openapi.json",
      });
    });
  }

  // ── 404 handler ────────────────────────────────────────────────────────────

  app.use((req, res, next) => next(new NotFoundError(`Route not found: ${req.method} ${req.path}`)));

  // ── Error handler ──────────────────────────────────────────────────────────

  app.use((err, req, res, next) => {
    const status = err instanceof AppError ? err.statusCode : 500;
    const requestId = req?.requestId ?? null;
    const isProduction = process.env.NODE_ENV === "production";
    const payload = err.serialize
      ? err.serialize(requestId)
      : {
          ok: false,
          error: {
            code: status >= 500 && isProduction ? "internal_error" : (err.code || "internal_error"),
            message:
              status >= 500 && isProduction
                ? "Internal server error"
                : (err.message ?? "Internal server error"),
          },
          meta: {
            requestId,
          },
        };

    if (req?.requestId) res.setHeader("x-request-id", req.requestId);

    if (process.env.NODE_ENV === "development") {
      console.error("[ERROR]", err.stack ?? err);
    } else {
      console.error("[ERROR]", err.message ?? err);
    }

    if (process.env.SENTRY_DSN) {
      import("@sentry/node").then((m) => m.default).then((Sentry) => Sentry.captureException(err)).catch(() => {});
    }

    res.status(status).json(payload);
  });

  return app;
}
