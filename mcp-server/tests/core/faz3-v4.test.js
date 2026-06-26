/**
 * V4 Faz 3 — Eval Studio, cost guardrails, team packs tests.
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
import { runRegressionSuite, evalTemplateRegression } from "../../src/core/eval/eval-studio.service.js";
import {
  estimateTemplateCost,
  evaluateCostPolicy,
  detectCostAnomalies,
  preflightRunGuardrails,
} from "../../src/core/usage/cost-guardrails.service.js";
import { listIntegrationPacks, getIntegrationPack } from "../../src/core/marketplace/integration-packs.js";
import { addProjectMember, listProjectMembers, canAccessProject, resetTeamMembershipForTests } from "../../src/core/team/team-membership.service.js";

const WRITE_KEY = "faz3-test-write-key-32-chars!!";
const READ_KEY = "faz3-test-read-key---32-chars!!";

let request;

function withWrite(req) {
  return req
    .set("Authorization", `Bearer ${WRITE_KEY}`)
    .set("x-project-id", "faz3-test")
    .set("x-env", "test");
}

function withRead(req) {
  return req
    .set("Authorization", `Bearer ${READ_KEY}`)
    .set("x-project-id", "faz3-test")
    .set("x-env", "test");
}

describe("V4 Faz 3", () => {
  beforeAll(async () => {
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_ADMIN_KEY = WRITE_KEY;
    resetTeamMembershipForTests();
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  it("runRegressionSuite passes golden traces", () => {
    const report = runRegressionSuite();
    expect(report.summary.total).toBeGreaterThan(0);
    expect(report.pass).toBe(true);
  });

  it("evalTemplateRegression detects ci-failure-heal plan", () => {
    const result = evalTemplateRegression({
      templateId: "ci-failure-heal",
      parameters: { repo: "acme/app", branch: "main", failureLog: "fail" },
      golden: {
        expectedSteps: [
          { type: "tool", toolName: "repo_analyze" },
          { type: "tool", toolName: "repo_recent_commits" },
        ],
      },
      tolerances: { extraSteps: 20, orderStrict: true },
    });
    expect(result.pass).toBe(true);
  });

  it("GET /eval/golden lists traces", async () => {
    const res = await withRead(request.get("/eval/golden"));
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBeGreaterThan(0);
  });

  it("POST /eval/regression returns suite report", async () => {
    const res = await withRead(request.post("/eval/regression"));
    expect(res.status).toBe(200);
    expect(res.body.data.pass).toBe(true);
  });

  it("estimateTemplateCost returns breakdown", () => {
    const est = estimateTemplateCost("incident-triage", { repo: "a/b" });
    expect(est.ok).toBe(true);
    expect(est.estimatedCostUsd).toBeGreaterThan(0);
    expect(est.breakdown.length).toBeGreaterThan(0);
  });

  it("evaluateCostPolicy flags production destructive + high cost", () => {
    const result = evaluateCostPolicy({
      toolName: "git_push",
      estimatedCostUsd: 3,
      projectEnv: "production",
    });
    expect(result.requiresApproval).toBe(true);
    expect(result.destructive).toBe(true);
  });

  it("preflightRunGuardrails returns estimate", async () => {
    const data = await preflightRunGuardrails({
      templateId: "incident-triage",
      parameters: { repo: "a/b" },
      projectId: "faz3-test",
    });
    expect(data.estimate?.estimatedCostUsd).toBeGreaterThan(0);
  });

  it("detectCostAnomalies returns structure", async () => {
    const data = await detectCostAnomalies("faz3-test");
    expect(data.projectId).toBe("faz3-test");
    expect(data).toHaveProperty("hasAnomalies");
  });

  it("GET /usage/preflight returns guardrails", async () => {
    const res = await withRead(
      request.get("/usage/preflight?templateId=incident-triage&parameters=%7B%22repo%22%3A%22a%2Fb%22%7D")
    );
    expect(res.status).toBe(200);
    expect(res.body.data.estimate).toBeDefined();
  });

  it("integration packs are defined", () => {
    const packs = listIntegrationPacks();
    expect(packs.length).toBeGreaterThanOrEqual(5);
    expect(getIntegrationPack("developer")?.plugins).toContain("github");
  });

  it("GET /team/packs lists packs", async () => {
    const res = await withRead(request.get("/team/packs"));
    expect(res.status).toBe(200);
    expect(res.body.data.packs.length).toBeGreaterThanOrEqual(5);
  });

  it("team membership denies non-members when project has policy", () => {
    resetTeamMembershipForTests();
    addProjectMember({ projectId: "faz3-test", userId: "user-1", role: "admin" });
    expect(canAccessProject("faz3-test", "user-1")).toBe(true);
    expect(canAccessProject("faz3-test", "stranger")).toBe(false);
    expect(canAccessProject("open-project", "anyone")).toBe(true);
  });
});
