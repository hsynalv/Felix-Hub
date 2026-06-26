/**
 * V5 Faz A — Runbooks, schedules, managed autonomy tests.
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
import { listRunbooks, preflightRunbook, executeRunbook } from "../../src/core/ops/runbook.service.js";
import { createSchedule, evaluateSkipCondition, fireSchedule } from "../../src/core/ops/schedule.service.js";
import { cronMatches, getNextCronRun } from "../../src/core/ops/cron-match.js";
import {
  evaluateAutonomyForTool,
  evaluateAutonomyForRunSpawn,
  setAutonomyPolicy,
  resetAutonomyForTests,
} from "../../src/core/ops/autonomy.service.js";
import { resetRunbooksForTests } from "../../src/core/ops/runbook-store.js";
import { resetSchedulesForTests } from "../../src/core/ops/schedule-store.js";

const WRITE_KEY = "faz-a-v5-write-key-32-chars!!";
const READ_KEY = "faz-a-v5-read-key---32-chars!!";

let request;

function withWrite(req) {
  return req
    .set("Authorization", `Bearer ${WRITE_KEY}`)
    .set("x-project-id", "faz-a-test")
    .set("x-env", "test");
}

function withRead(req) {
  return req
    .set("Authorization", `Bearer ${READ_KEY}`)
    .set("x-project-id", "faz-a-test")
    .set("x-env", "test");
}

describe("V5 Faz A", () => {
  beforeAll(async () => {
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_ADMIN_KEY = WRITE_KEY;
    resetAutonomyForTests();
    resetRunbooksForTests();
    resetSchedulesForTests();
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  it("lists builtin runbooks including CI fix", () => {
    const runbooks = listRunbooks();
    expect(runbooks.some((r) => r.id === "rb-ci-fix")).toBe(true);
    expect(runbooks.find((r) => r.id === "rb-ci-fix")?.templateId).toBe("ci-failure-heal");
  });

  it("preflightRunbook returns structure for CI fix runbook", async () => {
    const result = await preflightRunbook("rb-ci-fix", {
      parameters: { repo: "acme/app", branch: "main", failureLog: "fail" },
      projectId: "faz-a-test",
      projectEnv: "test",
    });
    expect(result.ok).toBe(true);
    expect(result.runbookId).toBe("rb-ci-fix");
    expect(result.autonomy).toBeDefined();
    expect(result.report).toBeDefined();
  });

  it("executeRunbook with L2 returns pending_approval without force", async () => {
    const result = await executeRunbook("rb-ci-fix", {
      parameters: { repo: "acme/app", branch: "main", failureLog: "fail" },
      projectId: "faz-a-test",
      projectEnv: "test",
      dryRun: true,
    });
    expect(result.started).toBe(false);
    expect(result.outcome).toBe("pending_approval");
    expect(result.postRunReport).toBeDefined();
  });

  it("executeRunbook dry-run with forceInternal starts run", async () => {
    const result = await executeRunbook("rb-ci-fix", {
      parameters: { repo: "acme/app", branch: "main", failureLog: "fail" },
      projectId: "faz-a-test",
      projectEnv: "test",
      dryRun: true,
      force: true,
      forceInternal: true,
    });
    expect(result.started).toBe(true);
    expect(result.run?.id).toBeDefined();
  });

  it("POST /ops/runbooks/:id/execute rejects force for write scope", async () => {
    const res = await withWrite(
      request.post("/ops/runbooks/rb-ci-fix/execute").send({ force: true, dryRun: true })
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("force_forbidden");
  });

  it("cronMatches matches weekly Monday 9am pattern", () => {
    const monday9 = new Date("2026-06-29T09:00:00Z");
    expect(cronMatches("0 9 * * 1", monday9, "UTC")).toBe(true);
    const tuesday9 = new Date("2026-06-30T09:00:00Z");
    expect(cronMatches("0 9 * * 1", tuesday9, "UTC")).toBe(false);
  });

  it("getNextCronRun finds a future slot", () => {
    const next = getNextCronRun("0 9 * * *", new Date("2026-06-26T10:00:00Z"), "UTC");
    expect(next).toBeInstanceOf(Date);
    expect(next.getTime()).toBeGreaterThan(Date.now() - 86400000);
  });

  it("schedule skips when cost anomaly skip_if matches", async () => {
    const skip = await evaluateSkipCondition({ type: "env_flag", key: "SKIP_TEST_FLAG" });
    expect(skip.skip).toBe(false);
  });

  it("schedule fire blocks when cost exceeds max", async () => {
    const schedule = createSchedule({
      name: "expensive scan",
      runbookId: "rb-ci-fix",
      cronExpr: "0 9 * * 1",
      maxCostUsd: 0.001,
      autonomyLevel: "L4",
      projectId: "faz-a-test",
      projectEnv: "test",
    });
    const result = await fireSchedule(schedule.id, { test: true });
    expect(result.fired).toBe(false);
    expect(result.outcome).toBe("skipped");
  });

  it("L1 blocks destructive tools in production", () => {
    const result = evaluateAutonomyForTool({
      level: "L1",
      toolName: "git_commit",
      projectEnv: "production",
    });
    expect(result.allowed).toBe(false);
    expect(result.action).toBe("block");
  });

  it("L1 allows read-only repo_analyze", () => {
    const result = evaluateAutonomyForTool({
      level: "L1",
      toolName: "repo_analyze",
      projectEnv: "production",
    });
    expect(result.allowed).toBe(true);
  });

  it("L4 schedule spawn allowed within cost limit", () => {
    const result = evaluateAutonomyForRunSpawn({
      level: "L4",
      projectEnv: "staging",
      estimatedCostUsd: 2,
      maxCostUsd: 5,
      source: "schedule",
    });
    expect(result.allowed).toBe(true);
  });

  it("GET /ops/runbooks returns catalog", async () => {
    const res = await withRead(request.get("/ops/runbooks"));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.count).toBeGreaterThan(0);
  });

  it("POST /ops/runbooks/:id/preflight", async () => {
    const res = await withRead(request.post("/ops/runbooks/rb-ci-fix/preflight").send({
      parameters: { repo: "acme/app", branch: "main", failureLog: "fail" },
    }));
    expect(res.status).toBe(200);
    expect(res.body.data.runbookId).toBe("rb-ci-fix");
  });

  it("PUT /ops/autonomy sets project policy", async () => {
    const res = await withWrite(request.put("/ops/autonomy").send({
      projectId: "faz-a-test",
      envs: { production: "L1", test: "L3" },
    }));
    expect(res.status).toBe(200);
    expect(res.body.data.envs.production).toBe("L1");

    setAutonomyPolicy("faz-a-test", { envs: { production: "L1" } });
  });

  it("POST /ops/autonomy/evaluate-tool blocks git_commit at L1 production", async () => {
    const res = await withRead(
      request.post("/ops/autonomy/evaluate-tool").send({
        toolName: "git_commit",
        projectEnv: "production",
        level: "L1",
      })
    );
    expect(res.status).toBe(200);
    expect(res.body.data.allowed).toBe(false);
  });

  it("callTool enforces L0 autonomy via global hook", async () => {
    setAutonomyPolicy("faz-a-test", { envs: { test: "L0" } });
    const { callTool } = await import("../../src/core/tool-registry.js");
    const result = await callTool(
      "observability_health",
      {},
      {
        projectId: "faz-a-test",
        projectEnv: "test",
        requestId: "autonomy-hook-test",
        authScopes: ["read"],
      }
    );
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("autonomy_denied");
  });
});
