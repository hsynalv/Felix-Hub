import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/plugins/notion/notion-database-parent.js", () => ({
  queryNotionDatabase: vi.fn(),
  createNotionDatabaseRow: vi.fn(),
  listDatabaseDataSources: vi.fn(),
  clearNotionDataSourceCache: vi.fn(),
}));

vi.mock("../../src/plugins/notion/notion.client.js", () => ({
  notionRequest: vi.fn(),
  NOTION_VERSION_LATEST: "2025-09-03",
}));

describe("notion MCP project tools", () => {
  beforeEach(async () => {
    vi.resetModules();
    process.env.NOTION_PROJECTS_DB_ID = "proj-db-id";
    process.env.NOTION_TASKS_DB_ID = "task-db-id";
  });

  it("notion_list_projects returns mapped projects", async () => {
    const { queryNotionDatabase } = await import(
      "../../src/plugins/notion/notion-database-parent.js"
    );
    queryNotionDatabase.mockResolvedValue({
      ok: true,
      data: {
        results: [
          {
            id: "p1",
            url: "https://notion.so/p1",
            properties: {
              Name: { title: [{ plain_text: "GIGI" }] },
              Status: { status: { name: "Yapılıyor" } },
            },
          },
        ],
      },
    });

    const { listProjectsInNotion } = await import("../../src/plugins/notion/index.js");
    const result = await listProjectsInNotion({ limit: 10 });
    expect(result.ok).toBe(true);
    expect(result.data.count).toBe(1);
    expect(result.data.projects[0].name).toBe("GIGI");
  });

  it("notion_setup_project tool handler delegates to setupProjectInNotion", async () => {
    const { createNotionDatabaseRow } = await import(
      "../../src/plugins/notion/notion-database-parent.js"
    );
    createNotionDatabaseRow
      .mockResolvedValueOnce({
        ok: true,
        data: { id: "proj-1", url: "https://notion.so/proj-1", properties: {} },
      });

    const { tools } = await import("../../src/plugins/notion/index.js");
    const setup = tools.find((t) => t.name === "notion_setup_project");
    expect(setup).toBeDefined();

    const result = await setup.handler({
      name: "Deneme telegram",
      explanation: "User requested via Telegram",
    });
    expect(result.ok).toBe(true);
    expect(result.data.project.name).toBe("Deneme telegram");
  });
});
