/**
 * MCP connector service — CRUD and validation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../../src/core/persistence/index.js", () => ({
  isPersistenceHealthy: vi.fn(() => false),
  persistenceQuery: vi.fn(),
  randomUUID: vi.fn(() => "11111111-1111-1111-1111-111111111111"),
}));

import {
  createConnector,
  getConnector,
  getConnectorBySlug,
  listConnectors,
  updateConnector,
  deleteConnector,
  validateSlug,
  validateCommand,
  validateArgs,
  resolveConnectorArgs,
  resetConnectorsForTests,
} from "../../../src/core/mcp-connectors/connector.service.js";

describe("connector.service", () => {
  beforeEach(() => {
    resetConnectorsForTests();
  });

  it("validates slug format", () => {
    expect(() => validateSlug("")).toThrow();
    expect(() => validateSlug("Bad")).toThrow();
    expect(() => validateSlug("tavily")).not.toThrow();
  });

  it("validates allowed commands", () => {
    expect(() => validateCommand("bash")).toThrow();
    expect(validateCommand("npx")).toBe("npx");
  });

  it("validates args JSON array", () => {
    expect(validateArgs(["-y", "pkg"])).toEqual(["-y", "pkg"]);
    expect(() => validateArgs({ foo: 1 })).toThrow();
  });

  it("resolves env placeholders in args", () => {
    const args = resolveConnectorArgs(
      ["https://mcp.tavily.com/mcp/?tavilyApiKey={TAVILY_API_KEY}"],
      { TAVILY_API_KEY: "tvly-secret" }
    );
    expect(args[0]).toBe("https://mcp.tavily.com/mcp/?tavilyApiKey=tvly-secret");
  });

  it("creates and lists connectors in memory", async () => {
    const created = await createConnector({
      slug: "tavily",
      displayName: "Tavily",
      command: "npx",
      args: ["-y", "@tavily/mcp"],
      envKeys: ["TAVILY_API_KEY"],
    });

    expect(created.id).toBeTruthy();
    expect(created.enabled).toBe(false);

    const list = await listConnectors();
    expect(list).toHaveLength(1);
    expect(list[0].slug).toBe("tavily");

    const bySlug = await getConnectorBySlug("tavily");
    expect(bySlug?.displayName).toBe("Tavily");

    const fetched = await getConnector(created.id);
    expect(fetched?.command).toBe("npx");
  });

  it("rejects duplicate slug", async () => {
    await createConnector({
      slug: "figma",
      displayName: "Figma",
      command: "npx",
      args: ["-y", "figma-mcp"],
    });
    await expect(
      createConnector({
        slug: "figma",
        displayName: "Figma 2",
        command: "npx",
        args: [],
      })
    ).rejects.toMatchObject({ code: "duplicate_slug" });
  });

  it("updates and deletes connector", async () => {
    const created = await createConnector({
      slug: "demo",
      displayName: "Demo",
      command: "node",
      args: ["server.js"],
    });

    const updated = await updateConnector(created.id, {
      displayName: "Demo MCP",
      args: ["index.js"],
    });
    expect(updated?.displayName).toBe("Demo MCP");
    expect(updated?.args).toEqual(["index.js"]);

    await deleteConnector(created.id);
    expect(await getConnector(created.id)).toBeNull();
  });
});
