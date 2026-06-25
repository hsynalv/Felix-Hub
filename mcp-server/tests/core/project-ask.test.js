/**
 * Project ask + impact API
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordContextEvent,
  searchContextForGoal,
  getProjectImpact,
  resetProjectContextForTests,
} from "../../src/core/project-context/project-context.service.js";
import { createProject, deleteProject } from "../../src/plugins/projects/projects.store.js";

describe("project ask / impact", () => {
  const key = "ask-test-proj";

  beforeEach(() => {
    resetProjectContextForTests();
    try {
      deleteProject(key);
    } catch {
      /* ignore */
    }
    createProject(key, "Ask Test");
  });

  it("searchContextForGoal ranks matching events", async () => {
    await recordContextEvent(key, {
      type: "github_pr",
      summary: "Merged auth refactor PR",
      refs: { repo: "org/auth-service" },
    });
    await recordContextEvent(key, {
      type: "obsidian_note",
      summary: "Unrelated shopping list",
    });

    const result = await searchContextForGoal(key, "auth refactor", { limit: 5 });
    expect(result.snippets.length).toBeGreaterThan(0);
    expect(result.snippets[0].text?.toLowerCase()).toContain("auth");
  });

  it("getProjectImpact filters by path", async () => {
    await recordContextEvent(key, {
      type: "github_push",
      summary: "Updated src/api/routes.js",
      refs: { path: "src/api/routes.js", repo: "org/hub" },
    });

    const impact = await getProjectImpact(key, "routes.js");
    expect(impact.events.length).toBeGreaterThan(0);
    expect(impact.path).toBe("routes.js");
  });
});
