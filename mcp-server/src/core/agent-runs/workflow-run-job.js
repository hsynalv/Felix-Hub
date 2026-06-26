/**
 * Execute workflow template steps as a background job.
 */

import { registerJobRunner } from "../jobs.js";
import { resolveTemplateForExecution } from "./workflow-template-store.js";
import { linkRunToJob } from "./agent-run-job.js";
import { executeWorkflowRun } from "./workflow-executor.js";
import { assertRunQuota } from "../usage/run-quota.js";

export const WORKFLOW_RUN_JOB_TYPE = "workflow_run";

export function registerWorkflowRunJobRunner() {
  registerJobRunner(WORKFLOW_RUN_JOB_TYPE, async (job, updateProgress, log) => {
    const {
      runId,
      templateId,
      params = {},
      dryRun = false,
      context = {},
      startFromStep = 0,
      singleStep = false,
    } = job.payload || {};
    const template = resolveTemplateForExecution(templateId);
    if (!template) throw new Error(`Unknown workflow template: ${templateId}`);
    if (!runId) throw new Error("workflow_run requires runId");

    linkRunToJob(runId, job.id);

    await assertRunQuota(context.projectId);

    return executeWorkflowRun({
      runId,
      template,
      params,
      dryRun,
      context,
      startFromStep,
      singleStep,
      updateProgress,
      log,
    });
  });
}
