/**
 * Agent runs service tests (memory fallback)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createRun,
  getRun,
  listRuns,
  appendRunStep,
  listRunSteps,
  updateRunStatus,
  findActiveRunForConversation,
  resetAgentRunsForTests,
  RunStatus,
  StepType,
} from "../../src/core/agent-runs/agent-runs.service.js";
import {
  ensureRunForChat,
  recordToolStep,
  completeRun,
} from "../../src/core/agent-runs/run-orchestrator.js";

describe("Agent runs (memory)", () => {
  beforeEach(() => {
    resetAgentRunsForTests();
  });

  it("creates and lists runs", async () => {
    const run = await createRun({ goal: "Test goal", projectId: "p1" });
    expect(run.id).toBeDefined();
    expect(run.status).toBe(RunStatus.RUNNING);

    const listed = await listRuns({ projectId: "p1" });
    expect(listed).toHaveLength(1);
    expect(listed[0].goal).toBe("Test goal");
  });

  it("appends tool steps", async () => {
    const run = await createRun({ goal: "Tool test" });
    await appendRunStep(run.id, {
      type: StepType.TOOL,
      toolName: "git_status",
      input: { path: "." },
      output: { ok: true },
      status: "ok",
      durationMs: 42,
    });

    const steps = await listRunSteps(run.id);
    expect(steps).toHaveLength(1);
    expect(steps[0].toolName).toBe("git_status");
    expect(steps[0].stepIndex).toBe(0);

    const updated = await getRun(run.id);
    expect(updated?.currentStep).toBe(1);
  });

  it("reuses active run for conversation", async () => {
    const convId = "conv-123";
    const run1 = await ensureRunForChat({
      conversationId: convId,
      goal: "First message",
      projectId: "proj",
    });
    const run2 = await ensureRunForChat({
      conversationId: convId,
      goal: "Second message",
      projectId: "proj",
    });
    expect(run2.id).toBe(run1.id);

    await completeRun(run1.id);
    const run3 = await ensureRunForChat({
      conversationId: convId,
      goal: "Third message",
    });
    expect(run3.id).not.toBe(run1.id);
  });

  it("records tool step via orchestrator", async () => {
    const run = await createRun({ goal: "Orch" });
    await recordToolStep(run.id, {
      toolName: "notion_search",
      input: { q: "test" },
      output: { ok: true, data: [] },
      durationMs: 10,
      phase: "end",
    });
    const steps = await listRunSteps(run.id);
    expect(steps[0].type).toBe(StepType.TOOL);
  });

  it("completes run", async () => {
    const run = await createRun({ goal: "Done" });
    const completed = await completeRun(run.id, { usage: { totalTokens: 100 } });
    expect(completed?.status).toBe(RunStatus.COMPLETED);
    expect(completed?.finishedAt).toBeTruthy();
  });

  it("findActiveRunForConversation returns running run", async () => {
    const convId = "c-1";
    await createRun({ goal: "A", conversationId: convId });
    const found = await findActiveRunForConversation(convId);
    expect(found).not.toBeNull();
    expect(found?.conversationId).toBe(convId);
  });

  it("updateRunStatus to waiting_approval", async () => {
    const run = await createRun({ goal: "Approve" });
    const updated = await updateRunStatus(run.id, RunStatus.WAITING_APPROVAL);
    expect(updated?.status).toBe(RunStatus.WAITING_APPROVAL);
  });
});
