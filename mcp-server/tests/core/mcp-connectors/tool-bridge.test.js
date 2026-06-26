/**
 * Tool bridge — federated naming and register/unregister
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  federatedToolName,
  federateConnector,
  unfederateConnector,
  testConnectorConnection,
  resetToolBridgeForTests,
} from "../../../src/core/mcp-connectors/tool-bridge.js";
import { listTools, callTool } from "../../../src/core/tool-registry.js";
import { resetConnectorsForTests } from "../../../src/core/mcp-connectors/connector.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCK_SERVER = join(__dirname, "../../fixtures/mock-mcp-server.js");

describe("tool-bridge", () => {
  beforeEach(() => {
    resetConnectorsForTests();
    resetToolBridgeForTests();
  });

  afterEach(() => {
    resetToolBridgeForTests();
  });

  it("prefixes upstream tool names with connector slug", () => {
    expect(federatedToolName("tavily", "tavily_search")).toBe("tavily__tavily_search");
  });

  it("federates mock stdio MCP tools", async () => {
    const connector = {
      id: "test-id",
      slug: "mockmcp",
      displayName: "Mock",
      command: "node",
      args: [MOCK_SERVER],
      envKeys: [],
      enabled: false,
    };

    const testResult = await testConnectorConnection(connector);
    expect(testResult.ok).toBe(true);
    expect(testResult.toolCount).toBe(1);

    const result = await federateConnector(connector, { persist: false });
    expect(result.toolCount).toBe(1);

    const tools = listTools();
    expect(tools.some((t) => t.name === "mockmcp__echo")).toBe(true);

    const call = await callTool("mockmcp__echo", { msg: "hi" }, { requestId: "test-req" });
    expect(call.ok).toBe(true);
    expect(call.data?.echoed ?? call.data?.content).toBeTruthy();

    await unfederateConnector("mockmcp", { persist: false });
    expect(listTools().some((t) => t.name === "mockmcp__echo")).toBe(false);
  }, 30_000);
});
