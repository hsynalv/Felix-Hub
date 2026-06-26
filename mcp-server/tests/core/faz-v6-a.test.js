/**
 * V6 Faz A — multi-agent, skills, watchers, sandbox, trust.
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
import { resetSkillsForTests } from "../../src/core/v6/skill-store.js";
import { resetWatchersForTests } from "../../src/core/v6/watcher-store.js";
import { resetSandboxForTests } from "../../src/core/v6/sandbox-store.js";
import { resetTrustForTests } from "../../src/core/v6/trust-store.js";
import { compileSkillToWorkflow } from "../../src/core/v6/skill.service.js";
import { roleAllowsTool } from "../../src/core/v6/agent-roles.js";
import { getSandboxSession } from "../../src/core/v6/sandbox-store.js";
import { executeBeforeHooks } from "../../src/core/tool-hooks.js";

const WRITE_KEY = "v6-faz-write-key----32-chars!!";
const READ_KEY = "v6-faz-read-key-----32-chars!!";

let request;

describe("V6 Faz A", () => {
  beforeAll(async () => {
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_ADMIN_KEY = WRITE_KEY;
    resetSkillsForTests();
    resetWatchersForTests();
    resetSandboxForTests();
    resetTrustForTests();
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  it("lists builtin skills and compiles template skill", () => {
    const compiled = compileSkillToWorkflow("skill-ci-heal", { repoUrl: "https://example.com" });
    expect(compiled.templateId).toBe("ci-failure-heal");
    expect(compiled.source).toBe("template");
  });

  it("role policy blocks planner from arbitrary tools", () => {
    expect(roleAllowsTool("planner", "agent_workflow_create")).toBe(true);
    expect(roleAllowsTool("planner", "n8n_trigger")).toBe(false);
  });

  it("GET /skills returns builtin skills", async () => {
    const res = await request.get("/skills").set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBeGreaterThan(0);
    expect(res.body.data.skills.some((s) => s.id === "skill-ci-heal")).toBe(true);
  });

  it("multi-agent parent spawn and aggregate", async () => {
    const parentRes = await request
      .post("/multi-agent/parents")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ goal: "V6 test parent" });
    expect(parentRes.status).toBe(201);
    const parentId = parentRes.body.data.id;

    const spawnRes = await request
      .post(`/multi-agent/parents/${parentId}/spawn`)
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ role: "executor", templateId: "incident-triage", dryRun: true });
    expect(spawnRes.status).toBe(201);
    expect(spawnRes.body.data.metadata.parentRunId).toBe(parentId);

    const aggRes = await request
      .get(`/multi-agent/parents/${parentId}/aggregate`)
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(aggRes.status).toBe(200);
    expect(aggRes.body.data.summary.totalChildren).toBe(1);
  });

  it("watcher create, test-fire, and dispatch", async () => {
    const createRes = await request
      .post("/watchers")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({
        name: "Test watcher",
        templateId: "incident-triage",
        source: "generic",
        dryRun: true,
        cooldownMinutes: 0,
      });
    expect(createRes.status).toBe(201);
    const watcherId = createRes.body.data.id;

    const fireRes = await request
      .post(`/watchers/${watcherId}/test-fire`)
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ message: "test" });
    expect(fireRes.status).toBe(200);
    expect(fireRes.body.data.runId).toBeTruthy();

    const dispatchRes = await request
      .post("/watchers/dispatch")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ source: "generic", message: "dispatch test", severity: "error" });
    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.data).toHaveProperty("results");
  });

  it("sandbox session mocks tool execution via hook", async () => {
    const createRes = await request
      .post("/sandbox/sessions")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ name: "hook test" });
    expect(createRes.status).toBe(201);
    const sandboxId = createRes.body.data.id;

    const hookResult = await executeBeforeHooks("n8n_list_workflows", {}, { sandboxId });
    expect(hookResult?.ok).toBe(true);
    expect(hookResult?.data?.mocked).toBe(true);

    const session = getSandboxSession(sandboxId);
    expect(session.calls.length).toBe(1);
  });

  it("trust recalculate returns scores array", async () => {
    const res = await request
      .post("/trust/recalculate")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({});
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.scores)).toBe(true);
  });
});
