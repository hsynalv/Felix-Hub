/**
 * Run control API tests — pause, retry-step, rollback, compare, state machine.
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import supertest from "supertest";

vi.mock("../../src/core/config.js", async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    config: {
      ...mod.config,
      persistence: { ...mod.config.persistence, enabled: false },
      redis: { ...mod.config.redis, enabled: false, url: undefined },
    },
  };
});

import { getIntegrationServer } from "../framework/test-server.js";
import { createRun, updateRunStatus, RunStatus } from "../../src/core/agent-runs/agent-runs.service.js";
import { assertRunStatusTransition } from "../../src/core/agent-runs/run-state-machine.js";

const WRITE_KEY = "run-control-test-write-key-32-chars";
const READ_KEY = "run-control-test-read-key---32-chars";

let request;

function withWrite(req) {
  return req
    .set("Authorization", `Bearer ${WRITE_KEY}`)
    .set("x-project-id", "run-control-test")
    .set("x-env", "test");
}

function withRead(req) {
  return req
    .set("Authorization", `Bearer ${READ_KEY}`)
    .set("x-project-id", "run-control-test")
    .set("x-env", "test");
}

describe("Run control API", () => {
  beforeAll(async () => {
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_ADMIN_KEY = WRITE_KEY;
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  it("state machine rejects invalid transition", () => {
    expect(() => assertRunStatusTransition(RunStatus.COMPLETED, RunStatus.RUNNING)).toThrow();
    expect(() => assertRunStatusTransition(RunStatus.RUNNING, RunStatus.PAUSED)).not.toThrow();
  });

  it("POST /runs/:id/pause pauses a running workflow run", async () => {
    const run = await createRun({
      goal: "pause test",
      metadata: { templateId: "incident-triage", parameters: {}, dryRun: true },
    });
    const res = await withWrite(request.post(`/runs/${run.id}/pause`));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(RunStatus.PAUSED);
  });

  it("POST /runs/:id/compare returns replay comparison", async () => {
    const run = await createRun({ goal: "compare test" });
    await updateRunStatus(run.id, RunStatus.COMPLETED);
    const res = await withRead(request.post(`/runs/${run.id}/compare`).send({ dryRun: true }));
    expect(res.status).toBe(200);
    expect(res.body.data.replayRunId).toBeDefined();
    expect(res.body.data.comparison).toBeDefined();
  });

  it("POST /runs/:id/retry-step requires workflow template", async () => {
    const run = await createRun({ goal: "retry test" });
    await updateRunStatus(run.id, RunStatus.FAILED);
    const res = await withWrite(request.post(`/runs/${run.id}/retry-step`).send({ stepIndex: 0 }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("not_workflow_run");
  });
});
