/**
 * Federate upstream MCP tools into the hub tool registry.
 */

import { registerTool, unregisterToolsForPlugin, ToolTags } from "../tool-registry.js";
import {
  connectMcpSession,
  listMcpTools,
  callMcpTool,
  closeMcpSession,
  mapMcpToolResult,
} from "./mcp-client.js";
import {
  buildConnectorEnv,
  recordConnectorHealth,
  setConnectorEnabled,
  buildConnectorLaunchContext,
} from "./connector.service.js";

/** @type {Map<string, { session: import("./mcp-client.js").McpClientSession, healthy: boolean, tools: string[] }>} */
const activeSessions = new Map();

export function federatedToolName(slug, upstreamName) {
  return `${slug}__${upstreamName}`;
}

function inferTags(tool) {
  const haystack = `${tool.name || ""} ${tool.description || ""}`.toLowerCase();
  const writeHints = /\b(create|update|delete|write|post|put|patch|remove|send|edit|upload)\b/;
  const tags = [ToolTags.NETWORK, ToolTags.EXTERNAL_API];
  if (writeHints.test(haystack)) {
    tags.push(ToolTags.WRITE);
  } else {
    tags.push(ToolTags.READ_ONLY);
  }
  return tags;
}

function launchConfig(connector, envOverrides = {}) {
  return buildConnectorLaunchContext(connector, envOverrides);
}

/**
 * @param {object} connector
 * @param {{ persist?: boolean, envOverrides?: Record<string, string> }} [options]
 */
export async function federateConnector(connector, { persist = true, envOverrides = {} } = {}) {
  const slug = connector.slug;
  await unfederateConnector(slug, { persist: false });

  let session;
  try {
    const launch = launchConfig(connector, envOverrides);
    session = await connectMcpSession({
      command: launch.command,
      args: launch.args,
      env: launch.env,
      slug,
    });
  } catch (err) {
    if (persist && connector.id) {
      await recordConnectorHealth(connector.id, { ok: false, error: err.message });
      await setConnectorEnabled(connector.id, false);
    }
    throw err;
  }

  let upstreamTools;
  try {
    upstreamTools = await listMcpTools(session);
  } catch (err) {
    await closeMcpSession(session);
    if (persist && connector.id) {
      await recordConnectorHealth(connector.id, { ok: false, error: err.message });
      await setConnectorEnabled(connector.id, false);
    }
    throw err;
  }

  const registered = [];
  for (const tool of upstreamTools) {
    const hubName = federatedToolName(slug, tool.name);
    registerTool({
      name: hubName,
      description: tool.description || `Upstream MCP tool (${slug})`,
      inputSchema: tool.inputSchema || { type: "object", properties: {} },
      plugin: slug,
      tags: inferTags(tool),
      handler: async (args) => {
        const entry = activeSessions.get(slug);
        if (!entry?.healthy || !entry.session) {
          return {
            ok: false,
            error: {
              code: "connector_unavailable",
              message: `External MCP connector "${slug}" is degraded or disabled`,
            },
          };
        }
        try {
          const result = await callMcpTool(entry.session, tool.name, args);
          return mapMcpToolResult(result);
        } catch (err) {
          entry.healthy = false;
          return {
            ok: false,
            error: {
              code: "upstream_call_failed",
              message: err.message || "Upstream MCP tool call failed",
            },
          };
        }
      },
    });
    registered.push(tool.name);
  }

  activeSessions.set(slug, {
    session,
    healthy: true,
    tools: registered,
  });

  if (persist && connector.id) {
    await recordConnectorHealth(connector.id, {
      ok: true,
      toolCount: registered.length,
    });
    await setConnectorEnabled(connector.id, true);
  }

  return { toolCount: registered.length, tools: registered };
}

/**
 * @param {string} slug
 * @param {{ persist?: boolean, connectorId?: string }} [options]
 */
export async function unfederateConnector(slug, { persist = true, connectorId = null } = {}) {
  const entry = activeSessions.get(slug);
  if (entry?.session) {
    await closeMcpSession(entry.session);
  }
  activeSessions.delete(slug);
  unregisterToolsForPlugin(slug);

  if (persist && connectorId) {
    await setConnectorEnabled(connectorId, false);
  }
}

/**
 * Test connector without persisting enable state.
 */
export async function testConnectorConnection(connector, { envOverrides = {} } = {}) {
  let session;
  try {
    const launch = launchConfig(connector, envOverrides);
    session = await connectMcpSession({
      command: launch.command,
      args: launch.args,
      env: launch.env,
      slug: connector.slug,
    });
    const tools = await listMcpTools(session);
    return { ok: true, toolCount: tools.length, tools: tools.map((t) => t.name) };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  } finally {
    await closeMcpSession(session);
  }
}

export async function disableConnector(connector) {
  await unfederateConnector(connector.slug, {
    persist: true,
    connectorId: connector.id,
  });
  if (connector.id) {
    await recordConnectorHealth(connector.id, {
      ok: connector.lastHealth === "ok",
      toolCount: 0,
    });
  }
}

export async function enableConnector(connector) {
  return federateConnector(connector, { persist: true });
}

export async function hydrateEnabledConnectors(listConnectorsFn) {
  const connectors = await listConnectorsFn();
  const enabled = connectors.filter((c) => c.enabled);
  const results = [];
  for (const connector of enabled) {
    try {
      const result = await federateConnector(connector, { persist: false });
      results.push({ slug: connector.slug, ok: true, ...result });
    } catch (err) {
      console.warn(`[mcp-connectors] Failed to hydrate ${connector.slug}: ${err.message}`);
      if (connector.id) {
        await recordConnectorHealth(connector.id, { ok: false, error: err.message });
        await setConnectorEnabled(connector.id, false);
      }
      results.push({ slug: connector.slug, ok: false, error: err.message });
    }
  }
  return results;
}

export function getActiveConnectorSlugs() {
  return [...activeSessions.keys()];
}

export function isConnectorActive(slug) {
  const entry = activeSessions.get(slug);
  return !!(entry?.healthy && entry.session);
}

export function resetToolBridgeForTests() {
  for (const slug of [...activeSessions.keys()]) {
    unfederateConnector(slug, { persist: false }).catch(() => {});
  }
  activeSessions.clear();
}
