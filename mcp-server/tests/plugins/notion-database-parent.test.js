import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/plugins/notion/notion.client.js", () => ({
  NOTION_VERSION_LATEST: "2025-09-03",
  notionRequest: vi.fn(),
}));

vi.mock("../../src/core/settings/effective-config.js", () => ({
  getEnvValue: vi.fn(() => undefined),
}));

import { notionRequest } from "../../src/plugins/notion/notion.client.js";
import { getEnvValue } from "../../src/core/settings/effective-config.js";
import {
  resolveDataSourceId,
  getDatabasePageParent,
  queryNotionDatabase,
  clearNotionDataSourceCache,
  createNotionDatabaseRow,
  extractDataSourceIdsFromNotionError,
  listDatabaseDataSources,
} from "../../src/plugins/notion/notion-database-parent.js";

const DB_ID = "f6760b0f-0783-417d-b4a8-9b7edce9e654";
const DS_ID = "e2bf5054-9427-4c7c-b86f-e991b18eac10";

describe("notion-database-parent", () => {
  beforeEach(() => {
    clearNotionDataSourceCache();
    vi.mocked(notionRequest).mockReset();
    vi.mocked(getEnvValue).mockReset();
    vi.mocked(getEnvValue).mockReturnValue(undefined);
  });

  it("resolves data_source_id from database discovery", async () => {
    notionRequest.mockResolvedValueOnce({
      ok: true,
      data: { data_sources: [{ id: DS_ID, name: "Projects" }] },
    });

    const id = await resolveDataSourceId(DB_ID);
    expect(id).toBe(DS_ID);
    expect(notionRequest).toHaveBeenCalledWith("GET", `/databases/${DB_ID}`, null, {
      notionVersion: "2025-09-03",
    });
  });

  it("uses env override for projects database", async () => {
    vi.mocked(getEnvValue).mockImplementation((key) => {
      if (key === "NOTION_PROJECTS_DB_ID") return DB_ID;
      if (key === "NOTION_PROJECTS_DATA_SOURCE_ID") return DS_ID;
      return undefined;
    });

    const id = await resolveDataSourceId(DB_ID);
    expect(id).toBe(DS_ID);
    expect(notionRequest).not.toHaveBeenCalled();
  });

  it("returns data_source_id parent when discovery succeeds", async () => {
    notionRequest.mockResolvedValueOnce({
      ok: true,
      data: { data_sources: [{ id: DS_ID }] },
    });

    const parent = await getDatabasePageParent(DB_ID);
    expect(parent).toEqual({ type: "data_source_id", data_source_id: DS_ID });
  });

  it("queries via data_sources endpoint when resolved", async () => {
    notionRequest
      .mockResolvedValueOnce({
        ok: true,
        data: { data_sources: [{ id: DS_ID }] },
      })
      .mockResolvedValueOnce({ ok: true, data: { results: [] } });

    const payload = { page_size: 10 };
    await queryNotionDatabase(DB_ID, payload);

    expect(notionRequest).toHaveBeenLastCalledWith(
      "POST",
      `/data_sources/${DS_ID}/query`,
      payload,
      { notionVersion: "2025-09-03" }
    );
  });

  it("extracts data_source_ids from notion error body", () => {
    const ids = extractDataSourceIdsFromNotionError({
      message: "validation error",
      body: { data_source_ids: [DS_ID] },
    });
    expect(ids).toEqual([DS_ID]);
  });

  it("retries page create with data source from error hints", async () => {
    notionRequest
      .mockResolvedValueOnce({ ok: true, data: {} })
      .mockResolvedValueOnce({
        ok: false,
        error: "notion_bad_request",
        details: {
          message: "Provided database_id ... is a database, not a database",
          body: { data_source_ids: [DS_ID] },
        },
      })
      .mockResolvedValueOnce({ ok: true, data: {} })
      .mockResolvedValueOnce({ ok: true, data: { id: "page-1", url: "https://notion.so/page-1" } });

    const result = await createNotionDatabaseRow(DB_ID, { Name: { title: [] } });
    expect(result.ok).toBe(true);
    expect(notionRequest).toHaveBeenLastCalledWith(
      "POST",
      "/pages",
      { parent: { type: "data_source_id", data_source_id: DS_ID }, properties: { Name: { title: [] } } },
      { notionVersion: "2025-09-03" }
    );
  });

  it("lists data sources via discovery endpoint helper", async () => {
    notionRequest.mockResolvedValueOnce({
      ok: true,
      data: {
        title: [{ plain_text: "Projeler" }],
        data_sources: [{ id: DS_ID, name: "Projeler" }],
      },
    });

    const result = await listDatabaseDataSources(DB_ID);
    expect(result.ok).toBe(true);
    expect(result.data.dataSources).toEqual([{ id: DS_ID, name: "Projeler" }]);
  });

  it("errors when integration cannot access data sources", async () => {
    notionRequest.mockResolvedValueOnce({ ok: true, data: { data_sources: [] } });

    const result = await listDatabaseDataSources(DB_ID);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("notion_no_data_sources");
  });
});
