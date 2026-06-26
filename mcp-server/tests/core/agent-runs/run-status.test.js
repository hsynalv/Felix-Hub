/**
 * Run status transitions (MVP — no formal guard yet).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createRun,
  updateRunStatus,
  resetAgentRunsForTests,
  RunStatus,
} from "../../../src/core/agent-runs/agent-runs.service.js";

describe("run status", () => {
  beforeEach(() => {
    resetAgentRunsForTests();
  });

  it("transitions running → paused → running", async () => {
    const run = await createRun({ goal: "status flow" });
    expect(run.status).toBe(RunStatus.RUNNING);

    const paused = await updateRunStatus(run.id, RunStatus.PAUSED);
    expect(paused?.status).toBe(RunStatus.PAUSED);

    const resumed = await updateRunStatus(run.id, RunStatus.RUNNING);
    expect(resumed?.status).toBe(RunStatus.RUNNING);
  });

  it("completed run has finishedAt", async () => {
    const run = await createRun({ goal: "done" });
    const completed = await updateRunStatus(run.id, RunStatus.COMPLETED);
    expect(completed?.status).toBe(RunStatus.COMPLETED);
    expect(completed?.finishedAt).toBeTruthy();
  });
});
