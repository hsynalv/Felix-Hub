/**
 * Expose external MCP connectors as plugin-shaped manifests for /plugins and env catalog.
 */

import { listTools } from "../tool-registry.js";
import { listConnectors } from "./connector.service.js";
import { getEnvValue } from "../settings/effective-config.js";

/**
 * @param {Awaited<ReturnType<typeof listConnectors>>} [connectors]
 */
export async function getConnectorPluginManifests(connectors = null) {
  const rows = connectors ?? (await listConnectors());
  const tools = listTools();

  return rows.map((connector) => {
    const pluginTools = tools
      .filter((t) => t.plugin === connector.slug)
      .map((t) => ({
        name: t.name,
        description: t.description,
        tags: t.tags,
        inputSchema: t.inputSchema,
      }));

    const missingEnv = (connector.envKeys ?? []).filter((key) => {
      const value = getEnvValue(key);
      return value == null || value === "";
    });

    return {
      name: connector.slug,
      displayName: connector.displayName,
      description: `Dış MCP bağlantısı (${connector.command})`,
      version: "mcp-connector",
      enabled: connector.enabled,
      external: true,
      connectorId: connector.id,
      tools: pluginTools,
      envVars: (connector.envKeys ?? []).map((name) => ({
        name,
        required: true,
        description: `${connector.displayName} API anahtarı`,
      })),
      missingEnv,
      state: {
        enabled: connector.enabled,
        lastHealth: connector.lastHealth,
        lastVerifiedAt: connector.lastVerifiedAt,
        toolCount: connector.toolCount,
      },
    };
  });
}
