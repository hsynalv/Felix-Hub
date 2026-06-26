/**
 * Hub workflow authoring tools (chat / MCP).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

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
import { callTool } from "../../src/core/tool-registry.js";
import { getWorkflowTemplate } from "../../src/core/agent-runs/workflow-templates.js";

let tempDir;

const WRITE_CTX = {
  scopes: ["read", "write"],
  user: "test-chat",
  projectId: "test-proj",
};

describe("agent workflow chat tools", () => {
  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "wf-templates-"));
    process.env.WORKFLOW_TEMPLATES_STORE = join(tempDir, "workflow-templates.json");
    await getIntegrationServer();
  }, 60000);

  afterAll(() => {
    delete process.env.WORKFLOW_TEMPLATES_STORE;
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("agent_workflow_templates lists builtin templates", async () => {
    const result = await callTool("agent_workflow_templates", {}, { scopes: ["read"] });
    expect(result.ok).toBe(true);
    expect(result.data.templates.length).toBeGreaterThan(0);
    expect(result.data.templates.some((t) => t.id === "repo-ship-feature")).toBe(true);
  });

  it("agent_workflow_preview builds plan from templateId", async () => {
    const result = await callTool(
      "agent_workflow_preview",
      {
        templateId: "repo-ship-feature",
        parameters: { repo: "acme/app", branch: "feat/x", goal: "Test", baseBranch: "main" },
      },
      { scopes: ["read"] }
    );
    expect(result.ok).toBe(true);
    expect(result.data.plan.phases.length).toBeGreaterThan(0);
    expect(result.data.stepCount).toBeGreaterThan(0);
  });

  it("agent_workflow_preview validates inline draft", async () => {
    const result = await callTool(
      "agent_workflow_preview",
      {
        draft: {
          name: "Chat draft",
          parameters: [{ name: "repo", type: "string", required: true }],
          steps: [{ type: "tool", toolName: "git_status", args: {} }],
        },
        parameters: {},
      },
      { scopes: ["read"] }
    );
    expect(result.ok).toBe(true);
    expect(result.data.templateName).toBe("Chat draft");
  });

  it("agent_workflow_create saves custom template", async () => {
    const result = await callTool(
      "agent_workflow_create",
      {
        explanation: "Test workflow from chat",
        name: "Chat test workflow",
        description: "Created in test",
        parameters: [{ name: "repo", type: "string", required: true }],
        steps: [
          { type: "tool", toolName: "repo_analyze", args: { repo: "{{repo}}" } },
          { type: "checkpoint", name: "review" },
        ],
      },
      WRITE_CTX
    );
    expect(result.ok).toBe(true);
    expect(result.data.template.id).toMatch(/^wf-/);
    expect(result.data.designerUrl).toContain("/workflows/designer/");
  });

  it("agent_run_from_template starts dry run", async () => {
    const builtin = getWorkflowTemplate("repo-ship-feature");
    expect(builtin).toBeTruthy();

    const result = await callTool(
      "agent_run_from_template",
      {
        explanation: "Dry-run ship feature workflow",
        templateId: "repo-ship-feature",
        parameters: {
          repo: "acme/app",
          branch: "feat/test",
          goal: "Chat run test",
          baseBranch: "main",
          skipIssues: "true",
        },
        dryRun: true,
        async: false,
      },
      WRITE_CTX
    );
    expect(result.ok).toBe(true);
    expect(result.data.run.id).toBeTruthy();
    expect(result.data.runsUrl).toContain("/runs/");
  });
});
