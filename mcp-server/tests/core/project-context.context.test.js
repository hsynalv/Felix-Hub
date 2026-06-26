import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/core/project-context/project-context.service.js", () => ({
  getProjectContext: vi.fn(),
  searchContextForGoal: vi.fn(),
  getProjectChanges: vi.fn(),
}));

import {
  getProjectContext,
  searchContextForGoal,
  getProjectChanges,
} from "../../src/core/project-context/project-context.service.js";
import {
  resolveProjectFetchStrategy,
  buildRoutedProjectContext,
} from "../../src/core/project-context/project-context.context.js";

describe("project-context.context", () => {
  beforeEach(() => {
    vi.mocked(getProjectContext).mockReset();
    vi.mocked(searchContextForGoal).mockReset();
    vi.mocked(getProjectChanges).mockReset();
  });

  it("resolveProjectFetchStrategy detects changes", () => {
    expect(resolveProjectFetchStrategy("son durum ne?")).toBe("changes");
  });

  it("resolveProjectFetchStrategy detects goal questions", () => {
    expect(resolveProjectFetchStrategy("auth nasıl çalışıyor?")).toBe("goal");
  });

  it("buildRoutedProjectContext skips without projectId", async () => {
    const r = await buildRoutedProjectContext({
      projectId: null,
      route: { needsProjectMemory: true },
    });
    expect(r.block).toBe("");
  });

  it("buildRoutedProjectContext uses getProjectChanges for change strategy", async () => {
    vi.mocked(getProjectChanges).mockResolvedValue({
      events: [{ id: "e1", eventType: "index", summary: "indexed" }],
      runs: [],
      summary: { eventCount: 1, runCount: 0 },
    });

    const r = await buildRoutedProjectContext({
      task: "son değişiklikler",
      projectId: "gigi",
      route: { needsProjectMemory: true },
    });

    expect(getProjectChanges).toHaveBeenCalled();
    expect(r.block).toContain("Project Context");
    expect(r.strategy).toBe("changes");
  });

  it("buildRoutedProjectContext uses searchContextForGoal for goal strategy", async () => {
    vi.mocked(searchContextForGoal).mockResolvedValue({
      snippets: [{ type: "event", text: "auth flow", score: 2 }],
      lastChangeSummary: "Recent work on auth",
    });
    vi.mocked(getProjectContext).mockResolvedValue({
      links: { githubRepo: "org/repo" },
      lastChangeSummary: "Recent work on auth",
    });

    const r = await buildRoutedProjectContext({
      task: "auth nasıl çalışıyor?",
      projectId: "gigi",
      route: { needsProjectMemory: true },
    });

    expect(searchContextForGoal).toHaveBeenCalled();
    expect(r.block).toContain("auth flow");
    expect(r.strategy).toBe("goal");
  });
});
