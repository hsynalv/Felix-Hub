/**
 * Checkpoint resume — persists current_step and resumes from checkpoint payload.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createRun,
  createCheckpoint,
  getLatestCheckpoint,
  updateRunCurrentStep,
  updateRunStatus,
  resetAgentRunsForTests,
  RunStatus,
} from "../../../src/core/agent-runs/agent-runs.service.js";
import { executeWorkflowRun } from "../../../src/core/agent-runs/workflow-executor.js";
import { getWorkflowTemplate } from "../../../src/core/agent-runs/workflow-templates.js";

vi.mock("../../../src/core/tool-registry.js", () => ({
  callTool: vi.fn(async (name) => ({ ok: true, data: { tool: name } })),
}));

describe("workflow checkpoint resume", () => {
  beforeEach(() => {
    resetAgentRunsForTests();
  });

  it("persists current_step at checkpoint and resumes from next phase", async () => {
    const template = getWorkflowTemplate("repo-ship-feature");
    const run = await createRun({
      goal: "checkpoint test",
      metadata: { templateId: template.id, parameters: { repo: "a/b", branch: "f", baseBranch: "main" } },
    });

    const first = await executeWorkflowRun({
      runId: run.id,
      template,
      params: { repo: "a/b", branch: "f", baseBranch: "main", skipIssues: "true" },
      dryRun: true,
      startFromStep: 0,
    });
    expect(first.paused).toBe(true);

    const paused = await updateRunStatus(run.id, RunStatus.PAUSED);
    expect(paused?.status).toBe(RunStatus.PAUSED);

    const cp = await getLatestCheckpoint(run.id, { type: "workflow" });
    expect(cp?.payload?.stepIndex).toBeGreaterThanOrEqual(0);

    const resumeFrom = Number(cp.payload.stepIndex) + 1;
    const second = await executeWorkflowRun({
      runId: run.id,
      template,
      params: { repo: "a/b", branch: "f", baseBranch: "main", skipIssues: "true" },
      dryRun: true,
      startFromStep: resumeFrom,
    });
    expect(second.completed || second.paused).toBeTruthy();
  });

  it("updateRunCurrentStep persists step index", async () => {
    const run = await createRun({ goal: "step persist" });
    await createCheckpoint(run.id, { type: "workflow", payload: { stepIndex: 2 } });
    const updated = await updateRunCurrentStep(run.id, 2);
    expect(updated?.currentStep).toBe(2);
  });
});
