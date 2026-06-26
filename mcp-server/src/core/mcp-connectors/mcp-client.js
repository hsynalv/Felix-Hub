/**
 * MCP stdio client session — spawn upstream server and call tools.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * @typedef {object} McpClientSession
 * @property {Client} client
 * @property {StdioClientTransport} transport
 * @property {string} slug
 */

/**
 * @param {{ command: string, args: string[], env?: Record<string, string>, slug?: string }} options
 * @returns {Promise<McpClientSession>}
 */
export async function connectMcpSession({ command, args, env = {}, slug = "external" }) {
  const transport = new StdioClientTransport({
    command,
    args: args ?? [],
    env: { ...process.env, ...env },
    stderr: "pipe",
  });

  const client = new Client(
    { name: "mcp-hub-connector", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  return { client, transport, slug };
}

/**
 * @param {McpClientSession} session
 */
export async function listMcpTools(session) {
  const result = await session.client.listTools();
  return result.tools ?? [];
}

/**
 * @param {McpClientSession} session
 * @param {string} name
 * @param {object} args
 */
export async function callMcpTool(session, name, args = {}) {
  return session.client.callTool({ name, arguments: args });
}

/**
 * @param {McpClientSession|null|undefined} session
 */
export async function closeMcpSession(session) {
  if (!session) return;
  try {
    await session.client.close();
  } catch {
    /* ignore */
  }
  try {
    await session.transport.close();
  } catch {
    /* ignore */
  }
}

/**
 * Map MCP tool result to hub tool handler shape.
 * @param {unknown} mcpResult
 */
export function mapMcpToolResult(mcpResult) {
  if (!mcpResult || typeof mcpResult !== "object") {
    return { ok: true, data: mcpResult };
  }

  const result = /** @type {{ isError?: boolean, content?: Array<{ type?: string, text?: string }> }} */ (
    mcpResult
  );

  if (result.isError) {
    const text = (result.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
    return {
      ok: false,
      error: {
        code: "upstream_tool_error",
        message: text || "Upstream MCP tool returned an error",
      },
    };
  }

  const textParts = (result.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "");

  if (textParts.length === 1) {
    try {
      return { ok: true, data: JSON.parse(textParts[0]) };
    } catch {
      return { ok: true, data: { content: textParts[0], raw: result } };
    }
  }

  return { ok: true, data: { content: textParts.join("\n"), raw: result } };
}
