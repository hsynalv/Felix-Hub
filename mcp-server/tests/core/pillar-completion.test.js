/**
 * Workflow templates + policy tool evaluate tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getWorkflowTemplate,
  listWorkflowTemplates,
  buildPlanFromTemplate,
  resolveTemplateArgs,
} from "../../src/core/agent-runs/workflow-templates.js";
import { replayRun } from "../../src/core/agent-runs/run-orchestrator.js";
import {
  createRun,
  appendRunStep,
  resetAgentRunsForTests,
  StepType,
} from "../../src/core/agent-runs/agent-runs.service.js";
import { evaluateTool } from "../../src/plugins/policy/policy.engine.js";
import { addRule, resetPolicyStoreForTests } from "../../src/plugins/policy/policy.store.js";

describe("workflow templates", () => {
  it("lists repo-ship-feature template", () => {
    const templates = listWorkflowTemplates();
    expect(templates.some((t) => t.id === "repo-ship-feature")).toBe(true);
    const t = getWorkflowTemplate("repo-ship-feature");
    expect(t?.steps.length).toBe(7);
  });

  it("resolves template placeholders", () => {
    const t = getWorkflowTemplate("repo-ship-feature");
    const plan = buildPlanFromTemplate(t, { repo: "a/b", branch: "feat", baseBranch: "main" });
    expect(plan.phases[0].args.repo).toBe("a/b");
    expect(resolveTemplateArgs("{{branch}}", { branch: "x" })).toBe("x");
  });
});

describe("replay run", () => {
  beforeEach(() => resetAgentRunsForTests());

  it("creates replay run with dry steps", async () => {
    const source = await createRun({ goal: "Original" });
    await appendRunStep(source.id, {
      type: StepType.TOOL,
      toolName: "git_status",
      input: {},
      output: { ok: true },
      status: "ok",
    });
    const replayed = await replayRun(source.id, { dryRun: true });
    expect(replayed?.metadata?.replayOf).toBe(source.id);
    expect(replayed?.status).toBe("completed");
  });
});

describe("policy evaluateTool", () => {
  beforeEach(() => resetPolicyStoreForTests());

  it("blocks shell in production", () => {
    addRule({
      toolPattern: "shell_*",
      environment: "production",
      action: "block",
      description: "no shell in prod",
    });
    const result = evaluateTool("shell_execute", { command: "ls" }, { environment: "production" });
    expect(result.allowed).toBe(false);
    expect(result.action).toBe("block");
  });

  it("allows shell in development", () => {
    addRule({
      toolPattern: "shell_*",
      environment: "production",
      action: "block",
    });
    const result = evaluateTool("shell_execute", {}, { environment: "development" });
    expect(result.allowed).toBe(true);
  });
});
