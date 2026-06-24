/**
 * MCP Gateway Server
 *
 * Creates an MCP server instance that exposes tools from the tool registry.
 * Supports both HTTP (Streamable HTTP) and STDIO transports.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { listTools, callTool } from "../core/tool-registry.js";

/**
 * Create an MCP server instance
 * @returns {Server} MCP server instance
 */
export function createMcpServer() {
  const server = new Server(
    {
      name: "mcp-hub",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        // resources and prompts can be added later
      },
    }
  );

  // Handle listTools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = listTools();
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema || { type: "object" },
      })),
    };
  });

  // Handle callTool request
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const context = {
      method: "MCP",
      user: request.context?.user || null,
      requestId: request.id,
    };

    const result = await callTool(name, args || {}, context);

    // Convert result to MCP format
    if (result.ok) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.data, null, 2),
          },
        ],
        isError: false,
      };
    } else {
      // Handle policy-driven responses
      if (result.error?.code === "require_approval") {
        return {
          content: [
            {
              type: "text",
              text: `⏳ Approval Required\n\n${result.error.message}\n\nApproval ID: ${result.error.approval?.id}`,
            },
          ],
          isError: false, // Not an error, just needs approval
        };
      }

      if (result.error?.code === "dry_run") {
        return {
          content: [
            {
              type: "text",
              text: `🔍 Dry Run Mode\n\n${result.error.message}\n\nPreview:\n\`\`\`json\n${JSON.stringify(result.error.preview, null, 2)}\n\`\`\``,
            },
          ],
          isError: false,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `❌ Error: ${result.error.code}\n\n${result.error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Handle a JSON-RPC message for the HTTP /mcp endpoint.
 * Returns the MCP result payload (not wrapped in JSON-RPC envelope) for compatibility
 * with integration tests and custom-llm clients.
 *
 * @param {object} message - JSON-RPC 2.0 request
 * @param {object} [context] - Auth and request context
 * @returns {Promise<object|null>} Result object or null when no response body
 */
export async function handleMcpHttpMessage(message, context = {}) {
  const { id, method, params = {} } = message;

  if (method === "initialize") {
    return {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "mcp-hub", version: "1.0.0" },
    };
  }

  if (method === "initialized" || method === "notifications/initialized") {
    return null;
  }

  if (method === "tools/list") {
    const tools = listTools();
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema || { type: "object" },
      })),
    };
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params;
    const callContext = {
      method: "MCP",
      user: context.user || null,
      scopes: context.scopes || [],
      projectId: context.projectId || null,
      projectEnv: context.projectEnv || null,
      requestId: context.requestId || id,
    };

    const result = await callTool(name, args || {}, callContext);

    if (result.ok) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.data, null, 2),
          },
        ],
        isError: false,
      };
    }

    if (result.error?.code === "require_approval") {
      return {
        content: [
          {
            type: "text",
            text: `⏳ Approval Required\n\n${result.error.message}\n\nApproval ID: ${result.error.approval?.id}`,
          },
        ],
        isError: false,
      };
    }

    if (result.error?.code === "dry_run") {
      return {
        content: [
          {
            type: "text",
            text: `🔍 Dry Run Mode\n\n${result.error.message}\n\nPreview:\n\`\`\`json\n${JSON.stringify(result.error.preview, null, 2)}\n\`\`\``,
          },
        ],
        isError: false,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `❌ Error: ${result.error?.code}\n\n${result.error?.message}`,
        },
      ],
      isError: true,
    };
  }

  const err = new Error(`Method not found: ${method}`);
  err.code = "method_not_found";
  throw err;
}
