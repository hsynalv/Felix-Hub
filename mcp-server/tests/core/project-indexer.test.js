/**
 * Project indexer — Notion branch (mocked)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncProjectIndex } from "../../src/core/project-context/project-indexer.js";
import { createProject, deleteProject, updateProjectLinks } from "../../src/plugins/projects/projects.store.js";
import { resetProjectContextForTests } from "../../src/core/project-context/project-context.service.js";

vi.mock("../../src/core/settings/effective-config.js", () => ({
  getEnvValue: vi.fn((key) => (key === "NOTION_TOKEN" ? "test-token" : null)),
}));

describe("project indexer notion", () => {
  const key = "notion-index-proj";

  beforeEach(() => {
    resetProjectContextForTests();
    try {
      deleteProject(key);
    } catch {
      /* ignore */
    }
    createProject(key, "Notion Index");
    updateProjectLinks(key, { notionProjectId: "db-abc-123" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: [
            {
              id: "page-1",
              url: "https://notion.so/page-1",
              properties: { Name: { title: [{ plain_text: "Sprint task" }] } },
            },
          ],
        }),
      }))
    );
  });

  it("records notion_page events on sync", async () => {
    const result = await syncProjectIndex(key, { sinceDays: 7 });
    expect(result.ok).toBe(true);
    expect(result.synced).toBeGreaterThan(0);
    expect(result.sources.notion).toBe("db-abc-123");
  });
});
