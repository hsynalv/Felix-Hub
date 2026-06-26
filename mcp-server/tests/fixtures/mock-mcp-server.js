#!/usr/bin/env node
/**
 * Minimal stdio MCP server for connector integration tests.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server({ name: "mock-external-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "echo",
      description: "Echo a message",
      inputSchema: {
        type: "object",
        properties: { msg: { type: "string" } },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const msg = request.params.arguments?.msg ?? "";
  return {
    content: [{ type: "text", text: JSON.stringify({ echoed: msg }) }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
