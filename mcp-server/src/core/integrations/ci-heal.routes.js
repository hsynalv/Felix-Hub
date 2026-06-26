/**
 * CI failure → self-healing workflow trigger.
 */

import { requireScope } from "../auth.js";
import { createRunFromTemplate } from "../agent-runs/run-orchestrator.js";
import { assertRunQuota } from "../usage/run-quota.js";
import { submitJob } from "../jobs.js";
import { WORKFLOW_RUN_JOB_TYPE } from "../agent-runs/workflow-run-job.js";
import { linkRunToJob } from "../agent-runs/agent-runs.service.js";
import { getWorkflowTemplate } from "../agent-runs/workflow-templates.js";

function quotaErrorResponse(res, e) {
  return res.status(429).json({
    ok: false,
    error: { code: "quota_exceeded", message: e.message },
  });
}

export function registerCiHealRoutes(app) {
  app.post("/integrations/ci/heal", requireScope("write"), async (req, res) => {
    try {
      const {
        repo,
        branch,
        checkName,
        failureLog,
        workspacePath,
        testCommand = "npm test",
        dryRun = false,
        async: runAsync = true,
      } = req.body ?? {};

      if (!repo) {
        return res.status(400).json({
          ok: false,
          error: { code: "invalid_request", message: "repo (owner/name) required" },
        });
      }

      const template = getWorkflowTemplate("ci-failure-heal");
      if (!template) {
        return res.status(500).json({
          ok: false,
          error: { code: "template_missing", message: "ci-failure-heal template not registered" },
        });
      }

      const parameters = {
        repo: String(repo),
        branch: branch ? String(branch) : "main",
        checkName: checkName ? String(checkName) : "CI",
        failureLog: failureLog ? String(failureLog).slice(0, 50_000) : "",
        workspacePath: workspacePath ? String(workspacePath) : ".",
        testCommand: String(testCommand),
      };

      const resolvedProjectId = req.projectId || req.body?.projectId || null;
      try {
        await assertRunQuota(resolvedProjectId);
      } catch (e) {
        if (e.code === "quota_exceeded") return quotaErrorResponse(res, e);
        throw e;
      }

      const run = await createRunFromTemplate("ci-failure-heal", parameters, {
        projectId: resolvedProjectId,
        createdBy: req.actor?.type || "ci-webhook",
        dryRun,
      });

      if (runAsync) {
        const job = submitJob(
          WORKFLOW_RUN_JOB_TYPE,
          {
            runId: run.id,
            templateId: "ci-failure-heal",
            params: parameters,
            dryRun,
            context: {
              projectId: req.projectId,
              projectEnv: req.projectEnv,
              scopes: req.authScopes,
              user: req.actor?.type || "ci-webhook",
              requestId: req.requestId,
            },
          },
          { projectId: req.projectId, user: req.actor?.type }
        );
        linkRunToJob(run.id, job.id);
        return res.status(201).json({
          ok: true,
          data: { runId: run.id, jobId: job.id, templateId: "ci-failure-heal", dryRun },
        });
      }

      res.status(201).json({ ok: true, data: { runId: run.id, templateId: "ci-failure-heal", dryRun } });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: { code: "ci_heal_failed", message: err.message },
      });
    }
  });
}
