/**
 * Project context service tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createProject, deleteProject } from "../../src/plugins/projects/projects.store.js";
import {
  getProjectContext,
  getProjectChanges,
  recordContextEvent,
  resetProjectContextForTests,
} from "../../src/core/project-context/project-context.service.js";
import { createRun, resetAgentRunsForTests } from "../../src/core/agent-runs/agent-runs.service.js";
import { completeRun } from "../../src/core/agent-runs/run-orchestrator.js";

describe("Project context", () => {
  const key = `test-ctx-${Date.now()}`;

  beforeEach(() => {
    resetProjectContextForTests();
    resetAgentRunsForTests();
    try {
      deleteProject(key);
    } catch {
      /* ignore */
    }
    createProject(key, "Test Context Project");
  });

  it("builds context graph with links and runs", async () => {
    const { updateProjectLinks } = await import("../../src/plugins/projects/projects.store.js");
    updateProjectLinks(key, { githubRepo: "acme/app", defaultBranch: "main" });

    const run = await createRun({ goal: "Ship feature", projectId: key });
    await recordContextEvent(key, { type: "manual", summary: "Config updated" });

    const ctx = await getProjectContext(key);
    expect(ctx.links?.githubRepo).toBe("acme/app");
    expect(ctx.graph.nodes.some((n) => n.type === "github_repo")).toBe(true);
    expect(Array.isArray(ctx.graph.edges)).toBe(true);
    expect(ctx.lastChangeSummary).toBeDefined();
    expect(ctx.recentRuns.length).toBeGreaterThanOrEqual(1);
    expect(ctx.recentEvents.length).toBeGreaterThanOrEqual(1);
    expect(ctx.recentRuns[0].id).toBe(run.id);
  });

  it("records context event on run complete", async () => {
    const run = await createRun({ goal: "Complete me", projectId: key });
    await completeRun(run.id, { usage: { totalTokens: 42, estimatedCostUsd: 0.01 } });

    const changes = await getProjectChanges(key, { sinceDays: 1 });
    expect(changes.events.some((e) => e.eventType === "run_completed")).toBe(true);
    expect(changes.summary.runCount).toBeGreaterThanOrEqual(1);
  });
});
