/**
 * Execute workflow template steps as a background job.
 */

import { registerJobRunner } from "../jobs.js";
import { callTool } from "../tool-registry.js";
import { getWorkflowTemplate, buildPlanFromTemplate } from "./workflow-templates.js";
import { getRun, updateRunStatus, RunStatus } from "./agent-runs.service.js";
import { recordToolStep, completeRun } from "./run-orchestrator.js";
import { linkRunToJob } from "./agent-run-job.js";
import { emitRunEvent } from "./run-events.js";

export const WORKFLOW_RUN_JOB_TYPE = "workflow_run";

export function registerWorkflowRunJobRunner() {
  registerJobRunner(WORKFLOW_RUN_JOB_TYPE, async (job, updateProgress, log) => {
    const { runId, templateId, params = {}, dryRun = false, context = {} } = job.payload || {};
    const template = getWorkflowTemplate(templateId);
    if (!template) throw new Error(`Unknown workflow template: ${templateId}`);
    if (!runId) throw new Error("workflow_run requires runId");

    linkRunToJob(runId, job.id);
    await updateRunStatus(runId, RunStatus.RUNNING);
    await log(`Workflow ${templateId} started (${template.steps.length} steps)`);

    const plan = buildPlanFromTemplate(template, params);
    const phases = plan.phases || [];

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      await updateProgress(Math.round(((i + 1) / phases.length) * 90));
      await log(`Step ${i + 1}/${phases.length}: ${phase.toolName}`);

      const toolStart = Date.now();
      let result;
      if (dryRun) {
        result = {
          ok: true,
          data: { dryRun: true, tool: phase.toolName, args: phase.args, simulated: true },
        };
      } else {
        result = await callTool(phase.toolName, phase.args, {
          ...context,
          runId,
          dryRun: false,
        });
      }

      await recordToolStep(runId, {
        toolName: phase.toolName,
        input: phase.args,
        output: result,
        durationMs: Date.now() - toolStart,
        phase: "end",
      });
      emitRunEvent(runId, { type: "tool", phase: "end", name: phase.toolName, result });

      if (result?.ok === false && !dryRun) {
        await completeRun(runId, { error: { message: `Step failed: ${phase.toolName}`, step: i } });
        throw new Error(`Workflow step failed: ${phase.toolName}`);
      }
    }

    await completeRun(runId);
    emitRunEvent(runId, { type: "status", status: RunStatus.COMPLETED });
    await updateProgress(100);
    await log("Workflow completed");
    return { templateId, steps: phases.length };
  });
}
