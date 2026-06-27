import express from "express";
import "express-async-errors";
import cors from "cors";
import morgan from "morgan";
import { AppError, NotFoundError } from "./errors.js";
import { config } from "./config.js";
import { loadPlugins, getPlugins } from "./plugins.js";
import { initializeToolHooks } from "./tool-registry.js";
import {
  getAuditManager,
  initAuditManager,
} from "./audit/index.js";
import { auditMiddleware, getLogs, getStats } from "./audit.js";
import { requireScope, isAuthEnabled, optionalAuthMiddleware, authEnabled, refreshAuthEnabledState } from "./auth.js";
import { sessionMiddleware } from "./auth/session-middleware.js";
import { requestContextMiddleware } from "./auth/request-context.js";
import { tenantOverlayMiddleware } from "./auth/tenant-middleware.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { seedOwnerAndMigrateSettings } from "./auth/seed.js";
import { submitJob, getJob, listJobs, getJobStats, cancelJob } from "./jobs.js";
import { validateSecurityConfigOrExit } from "./security/validate-security-config.js";
import { enforceSecurityContext } from "./security/enforce-security-context.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";
import { loadPresetsAtStartup, policyGuardrailMiddleware } from "./policy-guard.js";
import { getApprovalStore } from "./policy-hooks.js";
import { callTool, listTools, getTool } from "./tool-registry.js";
import { createMcpHttpMiddleware } from "../mcp/http-transport.js";
import { issueUiToken, issueUiTokenWithNotification } from "./ui-tokens.js";
import { normalizeCorrelationId } from "./audit/audit.standard.js";
import { registerUiChatRoutes } from "./ui-chat.js";
import { registerAgentRunRoutes } from "./agent-runs/routes.js";
import { registerApprovalRoutes } from "./approvals/routes.js";
import { registerCiHealRoutes } from "./integrations/ci-heal.routes.js";
import { registerObservabilityWebhookRoutes } from "./integrations/observability-webhook.routes.js";
import { registerEvalRoutes } from "./eval/eval.routes.js";
import { registerTeamRoutes } from "./team/team.routes.js";
import { registerOpsRoutes } from "./ops/routes.js";
import { startScheduleRunner } from "./ops/schedule-runner.js";
import { startBriefingSchedulerRunner } from "./v7/briefing-scheduler-runner.js";
import { registerAgentRoutes } from "./agents/routes.js";
import { registerBriefingRoutes } from "./reports/briefing.routes.js";
import { registerSlaRoutes } from "./sla/sla.routes.js";
import { registerEnvRoutes } from "./env/env.routes.js";
import { registerV6Routes } from "./v6/routes.js";
import { initSandboxHook } from "./v6/sandbox-hook.js";
import { registerInboxRoutes } from "./inbox/inbox.routes.js";
import { registerObservabilityProRoutes } from "./observability-pro/observability-pro.routes.js";
import { registerV6PhaseCRoutes } from "./v6-c/routes.js";
import { registerV7Routes } from "./v7/routes.js";
import { registerV8Routes } from "./v8/v8.routes.js";
import { registerSpecRoutes } from "./spec/spec.routes.js";
import { startSlaRunner } from "./sla/sla-runner.js";
import {
  canAccessProject,
  isTeamMembershipEnforced,
  projectHasMembershipPolicy,
} from "./team/team-membership.service.js";
import { registerAgentRunJobRunner } from "./agent-runs/agent-run-job.js";
import { registerWorkflowRunJobRunner } from "./agent-runs/workflow-run-job.js";
import { registerProjectIndexJobRunner } from "./project-context/project-index-job.js";
import {
  registerToolIntentTrainJobRunners,
  scheduleIntentTrainPipeline,
} from "./chat/tool-intent-train-job.js";
import { registerIntentTrainingRoutes } from "./intent-training/routes.js";
import { refreshIntentTrainConfigCache } from "./chat/tool-intent-config.js";
import { ensureNlpLoaded } from "./chat/tool-intent-nlp.js";
import { registerAgentRunTools } from "./agent-runs/agent-runs.tools.js";
import { registerProjectContextTools } from "./project-context/project-context.tools.js";
import { registerSidecarTools } from "./sidecar/sidecar-tools.js";
import { registerUsageRoutes } from "./usage/routes.js";
import { registerInternalMarketplaceRoutes } from "./marketplace/internal-routes.js";
import { registerMcpConnectorRoutes } from "./mcp-connectors/routes.js";
import { hydrateEnabledConnectors } from "./mcp-connectors/tool-bridge.js";
import { listConnectors } from "./mcp-connectors/connector.service.js";
import { getConnectorPluginManifests } from "./mcp-connectors/connector-plugins.js";
import { registerSidecarRoutes } from "./sidecar/sidecar-routes.js";
import { registerWorkspacePreferencesRoutes } from "./workspace-preferences.routes.js";
import { purgeOlderThan } from "./usage/usage-ledger.service.js";
import { initPersistence, getPersistenceStatus, isPersistenceHealthy } from "./persistence/index.js";
import { initMasterKey } from "./settings/crypto.js";
import { loadSettingsOverlay } from "./settings/effective-config.js";
import { registerSettingsRoutes } from "./settings/routes.js";
import { registerReloadHooks } from "./settings/reload-registry.js";
import { rateLimitMiddleware } from "./ratelimit.js";
import { skipForHtmlNavigation, wantsHtmlNavigation } from "./http/html-navigation.js";
import { BRAND } from "./branding.js";

import { workspaceContextMiddleware } from "./workspace.js";
import {
  discoveryVisibilityContextFromRequest,
  filterPluginsForDiscovery,
} from "./authorization/filter-visible-surfaces.js";
import { httpTelemetryContextMiddleware } from "./observability/telemetry-context.js";
import { httpHubAuditLifecycleMiddleware } from "./audit/emit-http-events.js";
import {
  emitRestDiscoveryRequested,
  emitRestDiscoveryFiltered,
  emitRestDiscoveryDenied,
} from "./audit/emit-discovery-http-event.js";
import { DiscoverySurfaces } from "./audit/discovery-surfaces.js";

function countPluginEndpoints(plugins) {
  let n = 0;
  for (const p of plugins) {
    if (Array.isArray(p.endpoints)) n += p.endpoints.length;
  }
  return n;
}

function countManifestTools(plugins) {
  let n = 0;
  for (const p of plugins) {
    if (Array.isArray(p.tools)) n += p.tools.length;
  }
  return n;
}

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
  req.correlationId = normalizeCorrelationId(req.headers["x-correlation-id"]);
  req.requestId = req.correlationId;
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

/** Deny project access when membership policy is active or TEAM_MEMBERSHIP_ENFORCE is set. */
function teamMembershipMiddleware(req, res, next) {
  const projectId = req.projectId;
  if (!projectId) return next();
  if (!isTeamMembershipEnforced() && !projectHasMembershipPolicy(projectId)) {
    return next();
  }

  const userId = req.user?.id || req.actor?.id || null;
  if (!canAccessProject(projectId, userId)) {
    return res.status(403).json({
      ok: false,
      error: {
        code: "project_access_denied",
        message: "Project membership required for this resource",
      },
    });
  }
  next();
}

export async function createServer() {
  validateSecurityConfigOrExit();

  const app = express();

  if (process.env.NODE_ENV === "production" || process.env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
  }

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
  app.use(httpHubAuditLifecycleMiddleware);
  app.use(sessionMiddleware);
  app.use(optionalAuthMiddleware);
  app.use(enforceSecurityContext);
  app.use(httpTelemetryContextMiddleware);
  app.use(responseEnvelopeMiddleware);
  app.use(teamMembershipMiddleware);
  app.use(requestContextMiddleware);
  app.use(tenantOverlayMiddleware);
  app.use(policyGuardrailMiddleware);

  registerAuthRoutes(app);

  // ── Core routes ────────────────────────────────────────────────────────────

  app.get("/health", async (_req, res) => {
    const persistence = getPersistenceStatus();
    const authOn = await authEnabled();
    res.json({
      status: "ok",
      auth: authOn ? "enabled" : "disabled",
      persistence,
    });
  });

  app.get("/whoami", requireScope("read"), (req, res) => {
    res.json({
      auth: {
        enabled: true,
        scopes: req.authScopes ?? [],
        mode: req.user ? "session" : req.actor?.type || "api_key",
      },
      actor: req.actor ?? null,
      user: req.user
        ? {
            id: req.user.userId,
            email: req.user.email,
            displayName: req.user.displayName,
            namespace: req.user.namespace,
          }
        : null,
      project: {
        id: req.projectId,
        env: req.projectEnv,
      },
    });
  });

  app.get("/plugins", skipForHtmlNavigation, requireScope("read"), async (req, res) => {
    void emitRestDiscoveryRequested(req, DiscoverySurfaces.REST_PLUGINS_LIST).catch(() => {});
    const vis = discoveryVisibilityContextFromRequest(req);
    const allPlugins = getPlugins();
    let connectors = [];
    try {
      connectors = await getConnectorPluginManifests();
    } catch {
      // connector manifests optional
    }
    const combined = [...allPlugins, ...connectors];
    const plugins = filterPluginsForDiscovery(combined, vis);
    const totalCandidates = listTools().length;
    const visibleCount = countManifestTools(plugins);
    void emitRestDiscoveryFiltered(req, DiscoverySurfaces.REST_PLUGINS_LIST, {
      totalCandidates,
      visibleCount,
    }).catch(() => {});
    res.json(plugins);
  });

  app.get("/plugins/:name/manifest", requireScope("read"), async (req, res) => {
    void emitRestDiscoveryRequested(req, DiscoverySurfaces.REST_PLUGIN_MANIFEST).catch(() => {});
    const vis = discoveryVisibilityContextFromRequest(req);
    let connectors = [];
    try {
      connectors = await getConnectorPluginManifests();
    } catch {
      // connector manifests optional
    }
    const plugins = filterPluginsForDiscovery([...getPlugins(), ...connectors], vis);
    const plugin = plugins.find((p) => p.name === req.params.name);
    if (!plugin) {
      void emitRestDiscoveryDenied(req, DiscoverySurfaces.REST_PLUGIN_MANIFEST, {
        httpStatus: 404,
        errorCode: "plugin_not_found",
        denyKind: "plugin_not_found",
      }).catch(() => {});
      return res.status(404).json({ ok: false, error: { code: "plugin_not_found", message: "Plugin not found" } });
    }
    void emitRestDiscoveryFiltered(req, DiscoverySurfaces.REST_PLUGIN_MANIFEST, {
      totalCandidates: 1,
      visibleCount: 1,
    }).catch(() => {});
    res.json(plugin);
  });

  /**
   * GET /openapi.json
   * Auto-generated OpenAPI spec from all plugin manifests.
   */
  app.get("/openapi.json", requireScope("read"), async (req, res) => {
    void emitRestDiscoveryRequested(req, DiscoverySurfaces.REST_OPENAPI_AGGREGATE).catch(() => {});
    const vis = discoveryVisibilityContextFromRequest(req);
    const allPlugins = getPlugins();
    const plugins = filterPluginsForDiscovery(allPlugins, vis);
    const totalCandidates = countPluginEndpoints(allPlugins);
    const visibleCount = countPluginEndpoints(plugins);
    void emitRestDiscoveryFiltered(req, DiscoverySurfaces.REST_OPENAPI_AGGREGATE, {
      totalCandidates,
      visibleCount,
    }).catch(() => {});
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
    const { source, plugin, operation, actor, limit = 100, offset = 0 } = req.query;
    const { queryAuditEvents } = await import("./audit/audit.service.js");
    const entries = await queryAuditEvents({
      source: source ? String(source) : undefined,
      plugin: plugin ? String(plugin) : undefined,
      operation: operation ? String(operation) : undefined,
      actor: actor ? String(actor) : req.actor?.id ? String(req.actor.id) : undefined,
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
        correlationId: req.correlationId,
        tenantId: req.headers["x-tenant-id"]?.toString().trim() || null,
        invokeSource: "rest",
        source: "rest",
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

  app.delete("/jobs/:id", requireScope("write"), async (req, res) => {
    const ok = await cancelJob(req.params.id, { cancelSource: "user" });
    if (!ok) {
      return res.status(409).json({
        ok: false,
        error: {
          code: "job_not_cancellable",
          message: "Job not found or not in a cancellable state (queued/running only)",
        },
        meta: { requestId: req.requestId },
      });
    }
    res.status(202).json({
      ok: true,
      data: { cancelled: true },
      meta: { requestId: req.requestId },
    });
  });

  // ── Tool registry routes ─────────────────────────────────────────────────

  function serializeToolForApi(tool) {
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema || { type: "object" },
      plugin: tool.plugin,
      tags: tool.tags,
      category: tool.category,
      status: tool.status,
    };
  }

  /** GET /tools — list registered MCP tools (optional ?plugin= filter) */
  app.get("/tools", skipForHtmlNavigation, requireScope("read"), (req, res) => {
    const { plugin } = req.query;
    let tools = listTools();
    if (plugin) {
      tools = tools.filter((t) => t.plugin === String(plugin));
    }
    res.json({ tools: tools.map(serializeToolForApi) });
  });

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

  /** GET /tools/:name — tool metadata by name */
  app.get("/tools/:name", requireScope("read"), (req, res) => {
    const tool = getTool(req.params.name);
    if (!tool) {
      return res.status(404).json({
        ok: false,
        error: { code: "tool_not_found", message: `Tool not found: ${req.params.name}` },
      });
    }
    res.json({ tool: serializeToolForApi(tool) });
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

  app.post("/ui/token", async (req, res) => {
    const usersActive = await authEnabled();
    const ip = req.ip || "";
    const isLocal = ip === "127.0.0.1" || ip === "::1" || ip.endsWith("::ffff:127.0.0.1");
    if (usersActive && !isLocal) {
      return res.status(403).json({
        ok: false,
        error: {
          code: "forbidden",
          message: "UI token issuance disabled when user auth is active. Use /auth/login.",
        },
        meta: { requestId: req.requestId },
      });
    }
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
  registerProjectIndexJobRunner();
  registerToolIntentTrainJobRunners();
  scheduleIntentTrainPipeline();
  registerIntentTrainingRoutes(app);
  registerAgentRunRoutes(app);
  registerApprovalRoutes(app);
  registerCiHealRoutes(app);
  registerObservabilityWebhookRoutes(app);
  registerEvalRoutes(app);
  registerTeamRoutes(app);
  registerOpsRoutes(app);
  registerAgentRoutes(app);
  registerBriefingRoutes(app);
  registerSlaRoutes(app);
  registerEnvRoutes(app);
  initSandboxHook();
  registerV6Routes(app);
  registerInboxRoutes(app);
  registerObservabilityProRoutes(app);
  registerV6PhaseCRoutes(app);
  registerV7Routes(app);
  registerV8Routes(app);
  registerSpecRoutes(app);
  startScheduleRunner();
  startBriefingSchedulerRunner();
  startSlaRunner();
  registerUsageRoutes(app);
  registerInternalMarketplaceRoutes(app);
  registerMcpConnectorRoutes(app);
  registerSidecarRoutes(app);
  registerWorkspacePreferencesRoutes(app);

  // ── Plugin loader ──────────────────────────────────────────────────────────

  await initPersistence();
  try {
    initMasterKey();
  } catch (err) {
    console.warn(`[settings] Master key init failed: ${err.message}`);
  }
  if (isPersistenceHealthy()) {
    await seedOwnerAndMigrateSettings();
    await refreshAuthEnabledState();
    const count = await loadSettingsOverlay();
    if (count > 0) console.log(`[settings] Loaded ${count} encrypted setting(s) from MSSQL`);

    await refreshIntentTrainConfigCache();
    ensureNlpLoaded().catch((err) => console.warn("[intent-nlp] preload failed:", err.message));

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
  registerProjectContextTools();
  registerSidecarTools();

  try {
    const hydrated = await hydrateEnabledConnectors(listConnectors);
    const ok = hydrated.filter((h) => h.ok).length;
    if (hydrated.length > 0) {
      console.log(`[mcp-connectors] Hydrated ${ok}/${hydrated.length} enabled connector(s)`);
    }
  } catch (err) {
    console.warn("[mcp-connectors] Startup hydrate failed:", err.message);
  }

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

  if (existsSync(spaIndexPath)) {
    app.use(express.static(appDistPath, { index: false }));
    app.get("*", (req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      if (req.path.includes(".")) return next();
      if (!wantsHtmlNavigation(req)) return next();
      res.setHeader("Cache-Control", "no-store");
      if (req.method === "HEAD") {
        res.setHeader("Content-Type", "text/html; charset=UTF-8");
        return res.status(200).end();
      }
      res.sendFile(spaIndexPath);
    });
  } else {
    console.warn("[spa] Build not found — run: npm run ui:build");
    app.get("/", (_req, res) => {
      res.json({
        ok: true,
        message: `${BRAND.hubName} API running — UI not built`,
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
