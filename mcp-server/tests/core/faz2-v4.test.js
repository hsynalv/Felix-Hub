/**
 * V4 Faz 2 — command center BFF + CI heal trigger tests.
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
import { createProject } from "../../src/plugins/projects/projects.store.js";
import { getWorkflowTemplate, buildPlanFromTemplate } from "../../src/core/agent-runs/workflow-templates.js";
import fixture from "../fixtures/runs/ci-failure-heal-dry.json";

const WRITE_KEY = "faz2-test-write-key-32-chars!!";
const READ_KEY = "faz2-test-read-key---32-chars!!";

let request;

function withWrite(req) {
  return req
    .set("Authorization", `Bearer ${WRITE_KEY}`)
    .set("x-project-id", "faz2-test-project")
    .set("x-env", "test");
}

function withRead(req) {
  return req
    .set("Authorization", `Bearer ${READ_KEY}`)
    .set("x-project-id", "faz2-test-project")
    .set("x-env", "test");
}

describe("V4 Faz 2", () => {
  beforeAll(async () => {
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_ADMIN_KEY = WRITE_KEY;
    const app = await getIntegrationServer();
    request = supertest(app);
    try {
      createProject("faz2-test-project", "Faz 2 Test");
    } catch {
      /* already exists */
    }
  }, 60000);

  it("GET /projects/:name/command-center returns aggregated payload", async () => {
    const res = await withRead(request.get("/projects/faz2-test-project/command-center"));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.project.key).toBe("faz2-test-project");
    expect(res.body.data.briefing).toBeDefined();
    expect(res.body.data.briefing.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.data.integrations).toBeInstanceOf(Array);
    expect(res.body.data.usage).toBeDefined();
    expect(res.body.data.risks).toBeInstanceOf(Array);
  });

  it("ci-failure-heal template builds a multi-step plan", () => {
    const template = getWorkflowTemplate("ci-failure-heal");
    expect(template).toBeTruthy();
    const plan = buildPlanFromTemplate(template, fixture.parameters);
    const expectedTools =
      fixture.expectedSteps?.map((s) => s.toolName) ||
      fixture.expectedPhases ||
      [];
    expect(plan.templateId).toBe("ci-failure-heal");
    expect(plan.phases.length).toBeGreaterThanOrEqual(expectedTools.length);
    const tools = plan.phases.filter((p) => p.type === "tool").map((p) => p.toolName);
    for (const name of expectedTools) {
      expect(tools).toContain(name);
    }
  });

  it("POST /integrations/ci/heal creates a run (dryRun)", async () => {
    const res = await withWrite(request.post("/integrations/ci/heal")).send({
      repo: "acme/webapp",
      branch: "main",
      failureLog: "test failure",
      dryRun: true,
      async: false,
    });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.runId).toBeTruthy();
    expect(res.body.data.templateId).toBe("ci-failure-heal");
  });

  it("POST /integrations/ci/heal rejects missing repo", async () => {
    const res = await withWrite(request.post("/integrations/ci/heal")).send({});
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });
});
