/**
 * Agent runs REST API
 */

import { requireScope } from "../auth.js";
import {
  createRun,
  getRun,
  listRuns,
  listRunSteps,
  updateRunStatus,
  RunStatus,
} from "./agent-runs.service.js";
import { cancelRunJob, linkRunToJob } from "./agent-run-job.js";
import { resolvePendingApproval } from "./approval-bridge.js";
import { subscribeRunEvents } from "./run-events.js";
import { submitJob } from "../jobs.js";
import { AGENT_RUN_JOB_TYPE } from "./agent-run-job.js";
import { WORKFLOW_RUN_JOB_TYPE } from "./workflow-run-job.js";
import { listWorkflowTemplates } from "./workflow-templates.js";
import { createRunFromTemplate, replayRun } from "./run-orchestrator.js";

export function registerAgentRunRoutes(app) {
  app.post("/runs", requireScope("write"), async (req, res) => {
    try {
      const { goal, projectId, conversationId, metadata, plan, async: runAsync, message, history, model, systemPrompt } =
        req.body ?? {};
      const run = await createRun({
        goal: goal || "Manual run",
        projectId: projectId || req.projectId || null,
        conversationId: conversationId || null,
        createdBy: req.actor?.type || "api",
        metadata,
        plan,
      });

      if (runAsync && message) {
        const job = submitJob(
          AGENT_RUN_JOB_TYPE,
          {
            runId: run.id,
            message,
            history: history || [],
            model,
            systemPrompt,
            allowWriteTools: true,
            context: {
              projectId: projectId || req.projectId || null,
              projectEnv: req.projectEnv,
              scopes: req.authScopes,
              user: req.actor?.type || "api",
              requestId: req.requestId,
            },
          },
          { projectId: projectId || req.projectId, user: req.actor?.type }
        );
        linkRunToJob(run.id, job.id);
        return res.status(201).json({ ok: true, data: { ...run, jobId: job.id, async: true } });
      }

      res.status(201).json({ ok: true, data: run });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "create_failed", message: err.message } });
    }
  });

  app.get("/runs", requireScope("read"), async (req, res) => {
    try {
      const { status, projectId, conversationId, limit, offset } = req.query;
      const runs = await listRuns({
        status: status ? String(status) : undefined,
        projectId: projectId ? String(projectId) : req.projectId || undefined,
        conversationId: conversationId ? String(conversationId) : undefined,
        limit: Math.min(Number(limit) || 50, 100),
        offset: Number(offset) || 0,
      });
      res.json({ ok: true, data: { runs, count: runs.length } });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "list_failed", message: err.message } });
    }
  });

  app.get("/runs/:id", requireScope("read"), async (req, res) => {
    try {
      const run = await getRun(req.params.id);
      if (!run) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Run not found" } });
      }
      res.json({ ok: true, data: run });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "get_failed", message: err.message } });
    }
  });

  app.get("/runs/:id/steps", requireScope("read"), async (req, res) => {
    try {
      const run = await getRun(req.params.id);
      if (!run) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Run not found" } });
      }
      const steps = await listRunSteps(req.params.id, {
        limit: Math.min(Number(req.query.limit) || 100, 500),
        offset: Number(req.query.offset) || 0,
      });
      res.json({ ok: true, data: { steps, count: steps.length } });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "steps_failed", message: err.message } });
    }
  });

  app.get("/runs/:id/events", requireScope("read"), async (req, res) => {
    const run = await getRun(req.params.id);
    if (!run) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Run not found" } });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const write = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    write("meta", { runId: run.id, status: run.status });

    const unsubscribe = subscribeRunEvents(run.id, (payload) => {
      if (payload.type === "step") write("step", payload);
      else if (payload.type === "status") write("status", payload);
      else write("event", payload);
    });

    const heartbeat = setInterval(() => write("ping", { ts: Date.now() }), 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.post("/runs/:id/cancel", requireScope("write"), async (req, res) => {
    try {
      const run = await cancelRunJob(req.params.id, req.body?.reason || "user_cancelled");
      if (!run) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Run not found" } });
      }
      res.json({ ok: true, data: run });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "cancel_failed", message: err.message } });
    }
  });

  app.post("/runs/:id/approve", requireScope("write"), async (req, res) => {
    const { approval_id, approved = true } = req.body ?? {};
    if (!approval_id) {
      return res.status(400).json({
        ok: false,
        error: { code: "missing_approval_id", message: "approval_id required" },
      });
    }

    try {
      const run = await getRun(req.params.id);
      if (!run) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Run not found" } });
      }

      const outcome = await resolvePendingApproval(approval_id, approved, {
        actor: req.actor?.type || "manual",
        runId: run.id,
        scopes: req.authScopes,
      });

      if (!outcome) {
        return res.status(404).json({
          ok: false,
          error: { code: "approval_not_found", message: "Approval not found or already processed" },
        });
      }

      if (run.status === RunStatus.WAITING_APPROVAL && outcome.status === "approved") {
        await updateRunStatus(run.id, RunStatus.RUNNING);
      }

      res.json({
        ok: true,
        data: {
          status: outcome.status,
          result: outcome.result,
          runId: run.id,
          via: outcome.via,
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "approve_failed", message: err.message } });
    }
  });

  app.post("/runs/:id/resume", requireScope("write"), async (req, res) => {
    try {
      const run = await getRun(req.params.id);
      if (!run) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Run not found" } });
      }
      if (run.status !== RunStatus.WAITING_APPROVAL && run.status !== RunStatus.PAUSED) {
        return res.status(400).json({
          ok: false,
          error: { code: "invalid_state", message: `Cannot resume run in status ${run.status}` },
        });
      }
      const updated = await updateRunStatus(run.id, RunStatus.RUNNING);
      res.json({ ok: true, data: updated });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "resume_failed", message: err.message } });
    }
  });

  app.get("/runs/templates/list", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: { templates: listWorkflowTemplates() } });
  });

  app.post("/runs/from-template/:templateId", requireScope("write"), async (req, res) => {
    try {
      const { templateId } = req.params;
      const { parameters = {}, dryRun = false, async: runAsync = true } = req.body ?? {};
      const run = await createRunFromTemplate(templateId, parameters, {
        projectId: req.projectId || parameters.projectId || null,
        createdBy: req.actor?.type || "api",
        dryRun,
      });

      if (runAsync) {
        const job = submitJob(
          WORKFLOW_RUN_JOB_TYPE,
          {
            runId: run.id,
            templateId,
            params: parameters,
            dryRun,
            context: {
              projectId: req.projectId,
              projectEnv: req.projectEnv,
              scopes: req.authScopes,
              user: req.actor?.type || "api",
              requestId: req.requestId,
            },
          },
          { projectId: req.projectId, user: req.actor?.type }
        );
        linkRunToJob(run.id, job.id);
        return res.status(201).json({ ok: true, data: { ...run, jobId: job.id } });
      }

      res.status(201).json({ ok: true, data: run });
    } catch (err) {
      res.status(400).json({ ok: false, error: { code: "template_failed", message: err.message } });
    }
  });

  app.post("/runs/:id/replay", requireScope("write"), async (req, res) => {
    try {
      const dryRun = req.body?.dryRun !== false;
      const replayed = await replayRun(req.params.id, {
        dryRun,
        createdBy: req.actor?.type || "api",
      });
      if (!replayed) {
        return res.status(404).json({ ok: false, error: { code: "not_found", message: "Source run not found" } });
      }
      res.status(201).json({ ok: true, data: replayed });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "replay_failed", message: err.message } });
    }
  });
}
